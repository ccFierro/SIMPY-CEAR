-- Control de trayectorias SIMPY - CEAR. Script de personalizacion no threaded.
-- La app publica un comando en la escena; este script resuelve IK y avanza
-- los objetivos articulares en cada paso de simulacion.
sim = require('sim')
local TAG = 'SIMPY_motion_v1'
local COMMAND = 'SIMPY_motion_command'
local STATUS = 'SIMPY_motion_status'
local HEARTBEAT = 'SIMPY_motion_heartbeat'
local motion = nil

local function publish(id, state, message)
    sim.writeCustomTableData(sim.handle_scene, STATUS,
        {id = id or '', state = state, message = message or ''})
end

local function currentQ(joints)
    local q = {}
    for i, joint in ipairs(joints) do q[i] = sim.getJointPosition(joint) end
    return q
end

local function copyQ(q)
    local out = {}
    for i, value in ipairs(q) do out[i] = value end
    return out
end

local function multiplyQuaternion(a, b)
    return {
        a[4] * b[1] + b[4] * a[1] + a[2] * b[3] - a[3] * b[2],
        a[4] * b[2] + b[4] * a[2] + a[3] * b[1] - a[1] * b[3],
        a[4] * b[3] + b[4] * a[3] + a[1] * b[2] - a[2] * b[1],
        a[4] * b[4] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
    }
end

local function rotateVector(q, vector)
    local v = multiplyQuaternion(multiplyQuaternion(q,
        {vector[1], vector[2], vector[3], 0}), {-q[1], -q[2], -q[3], q[4]})
    return {v[1], v[2], v[3]}
end

local function difference(a, b)
    local biggest = 0
    for i = 1, 6 do biggest = math.max(biggest, math.abs(a[i] - b[i])) end
    return biggest
end

local function checkWrist(a, b)
    local yawChange = math.max(math.abs(b[4] - a[4]), math.abs(b[6] - a[6]))
    if yawChange < math.rad(10) then return end
    for i = 1, 20 do
        local q5 = a[5] + i / 20 * (b[5] - a[5])
        if math.abs(math.sin(q5)) < math.sin(math.rad(2.5)) then
            error('La ruta pasa cerca de una singularidad de muneca.')
        end
    end
end

local function jointsFromCommand(command)
    if type(command.joints) ~= 'table' or #command.joints ~= 6 then
        error('El robot necesita seis articulaciones ordenadas.')
    end
    local root = sim.getObject(command.root)
    local joints = {}
    for i, path in ipairs(command.joints) do
        local joint = sim.getObject(path)
        if sim.getObjectType(joint) ~= sim.object_joint_type then
            error('La articulacion ' .. i .. ' no existe.')
        end
        joints[i] = joint
    end
    local tcp = sim.getObject(command.tcp)
    return root, joints, tcp
end

local function ikEnvironment(root, joints, tcp)
    local ik = require('simIK')
    local env = ik.createEnvironment()
    local ok, result = pcall(function()
        local base = ik.createDummy(env)
        ik.setObjectMatrix(env, base, -1, sim.getObjectMatrix(root, -1))
        local parent = base
        local ikJoints, cyclic = {}, {}
        for i, real in ipairs(joints) do
            local joint = ik.createJoint(env, ik.jointtype_revolute)
            ik.setJointMode(env, joint, ik.jointmode_ik)
            local isCyclic, interval = sim.getJointInterval(real)
            ik.setJointInterval(env, joint, isCyclic, interval)
            ik.setJointPosition(env, joint, sim.getJointPosition(real))
            ik.setObjectMatrix(env, joint, -1, sim.getObjectMatrix(real, -1))
            ik.setObjectParent(env, joint, parent, true)
            parent = joint
            ikJoints[i], cyclic[i] = joint, isCyclic
        end
        local tip = ik.createDummy(env)
        ik.setObjectMatrix(env, tip, -1, sim.getObjectMatrix(tcp, -1))
        ik.setObjectParent(env, tip, parent, true)
        local target = ik.createDummy(env)
        ik.setTargetDummy(env, tip, target)
        local group = ik.createGroup(env)
        ik.setGroupCalculation(env, group, ik.method_damped_least_squares, 0.02, 160)
        local element = ik.addElement(env, group, tip)
        ik.setElementBase(env, group, element, base)
        ik.setElementConstraints(env, group, element, ik.constraint_pose)
        return {ik = ik, env = env, joints = ikJoints, cyclic = cyclic,
            tip = tip, target = target, group = group}
    end)
    if not ok then ik.eraseEnvironment(env); error(result) end
    return result
end

local function solve(context, pose, seed, realJoints)
    local ik, env = context.ik, context.env
    for i, joint in ipairs(context.joints) do
        ik.setJointPosition(env, joint, seed[i])
    end
    ik.setObjectPose(env, context.target, pose)
    local result = ik.handleGroup(env, context.group)
    if result ~= ik.result_success then error('La IK no alcanzo la pose solicitada.') end
    local reached = ik.getObjectPose(env, context.tip)
    local distance = 0
    for i = 1, 3 do distance = distance + (reached[i] - pose[i]) ^ 2 end
    if distance > 0.002 ^ 2 then error('La IK no alcanzo la posicion del TCP.') end
    local dot = 0
    for i = 4, 7 do dot = dot + reached[i] * pose[i] end
    if math.abs(dot) < math.cos(math.rad(3) / 2) then
        error('La IK no alcanzo la orientacion del TCP.')
    end
    local q = {}
    for i, joint in ipairs(context.joints) do
        local angle = ik.getJointPosition(env, joint)
        if context.cyclic[i] then
            angle = angle + 2 * math.pi * math.floor((seed[i] - angle) / (2 * math.pi) + 0.5)
        else
            local _, interval = sim.getJointInterval(realJoints[i])
            if angle < interval[1] - 0.001 or angle > interval[1] + interval[2] + 0.001 then
                error('J' .. i .. ' supera su limite articular.')
            end
        end
        q[i] = angle
    end
    return q
end

local function destinationPose(command, current)
    local values = command.pose
    if type(values) ~= 'table' or (#values ~= 3 and #values ~= 7) then
        error('La pose debe contener XYZ o XYZ y cuaternion.')
    end
    local pose = copyQ(current)
    for i = 1, 3 do pose[i] = values[i] end
    if #values == 7 then for i = 4, 7 do pose[i] = values[i] end end
    for _, value in ipairs(pose) do
        if type(value) ~= 'number' or value ~= value or math.abs(value) > 1e6 then
            error('La pose contiene valores invalidos.')
        end
    end
    return pose
end

local function prepare(command)
    local speed = command.speed
    if speed ~= nil then
        local jointMotion = command.kind == 'movej'
        local minimum = jointMotion and 0.05 or 0.01
        local maximum = jointMotion and 1.2 or 0.2
        if type(speed) ~= 'number' or speed ~= speed or speed < minimum or speed > maximum then
            error('Velocidad v fuera del rango permitido para ' .. tostring(command.kind) .. '.')
        end
    end
    local root, joints, tcp = jointsFromCommand(command)
    local startQ = currentQ(joints)
    local path = {startQ}
    local context = nil
    local linearStep, angularStep = 0, 0
    local ok, message = pcall(function()
        if command.kind == 'movej' and type(command.q) == 'table' then
            if #command.q ~= 6 then error('movej requiere seis angulos.') end
            local target = {}
            for i, angle in ipairs(command.q) do
                if type(angle) ~= 'number' or angle ~= angle then error('Angulo invalido.') end
                local cyclic, interval = sim.getJointInterval(joints[i])
                if cyclic then
                    angle = startQ[i] + (angle - startQ[i] + math.pi) % (2 * math.pi) - math.pi
                elseif angle < interval[1] or angle > interval[1] + interval[2] then
                    error('J' .. i .. ' supera su limite articular.')
                end
                target[i] = angle
            end
            checkWrist(startQ, target)
            path[2] = target
            return
        end
        context = ikEnvironment(root, joints, tcp)
        local startPose = sim.getObjectPose(tcp, sim.handle_world)
        local targetPose = destinationPose(command, startPose)
        if command.kind == 'movej' then
            local best, travel = nil, math.huge
            for _, turn in ipairs({0, math.pi / 2, -math.pi / 2, math.pi}) do
                local seed = copyQ(startQ)
                seed[1] = seed[1] + turn
                local solved, candidate = pcall(solve, context, targetPose, seed, joints)
                if solved then
                    local delta = difference(startQ, candidate)
                    if delta < travel and delta <= math.pi then
                        local safe = pcall(checkWrist, startQ, candidate)
                        if safe then best, travel = candidate, delta end
                    end
                end
            end
            if not best then error('IK no encontro una postura cercana para movej.') end
            path[2] = best
        elseif command.kind == 'movel' then
            local length = 0
            for i = 1, 3 do length = length + (targetPose[i] - startPose[i]) ^ 2 end
            length = math.sqrt(length)
            local dot = 0
            for i = 4, 7 do dot = dot + targetPose[i] * startPose[i] end
            local angle = 2 * math.acos(math.min(1, math.abs(dot)))
            local step = math.max(0.002, math.min(0.02, tonumber(command.step) or 0.005))
            local segments = math.max(1, math.ceil(length / step), math.ceil(angle / math.rad(5)))
            if segments > 400 then error('La trayectoria supera 400 puntos; dividela en tramos.') end
            linearStep, angularStep = length / segments, angle / segments
            local seed = startQ
            for i = 1, segments do
                local pose = sim.interpolatePoses(startPose, targetPose, i / segments)
                local q = solve(context, pose, seed, joints)
                if difference(seed, q) > math.rad(35) then
                    error('La IK cambio bruscamente de postura; usa una pose intermedia.')
                end
                checkWrist(seed, q)
                path[#path + 1] = q
                seed = q
            end
        else
            error('Tipo de movimiento desconocido.')
        end
    end)
    if context then context.ik.eraseEnvironment(context.env) end
    if not ok then error(message) end
    return {id = command.id, kind = command.kind, joints = joints, path = path, segment = 2,
        fraction = 0, commanded = startQ, started = sim.getSystemTime(), speed = speed,
        linearStep = linearStep, angularStep = angularStep}
end

local function prepareJog(command)
    if type(command.axis) ~= 'string' or
       not ({x = true, y = true, z = true, rx = true, ry = true, rz = true})[command.axis] then
        error('Eje cartesiano desconocido.')
    end
    if command.direction ~= 1 and command.direction ~= -1 then
        error('El sentido debe ser +1 o -1.')
    end
    if command.frame ~= 'tool' and command.frame ~= 'world' then
        error('Selecciona TCP o World como referencia.')
    end
    local speed = tonumber(command.speed)
    if not speed or speed < 1 or speed > 90 then
        error('La velocidad debe estar entre 1 y 90 mm/s o grados/s.')
    end
    local root, joints, tcp = jointsFromCommand(command)
    local context = ikEnvironment(root, joints, tcp)
    local q = currentQ(joints)
    return {id = command.id, kind = 'jog', joints = joints, tcp = tcp,
        context = context, pose = sim.getObjectPose(tcp, sim.handle_world),
        commanded = q, axis = command.axis, direction = command.direction,
        frame = command.frame, speed = speed, started = sim.getSystemTime()}
end

local function stopMotion(state, message)
    if motion then
        local measured = currentQ(motion.joints)
        for i, joint in ipairs(motion.joints) do
            sim.setJointTargetPosition(joint, measured[i])
        end
        if motion.context then
            motion.context.ik.eraseEnvironment(motion.context.env)
        end
        publish(motion.id, state, message)
        motion = nil
    end
end

local function advanceJog()
    local actual = currentQ(motion.joints)
    if difference(actual, motion.commanded) > math.rad(8) then return end
    local dt = math.max(0.001, sim.getSimulationTimeStep())
    local pose = copyQ(motion.pose)
    local axisName = motion.axis:sub(-1)
    local index = ({x = 1, y = 2, z = 3})[axisName]
    local vector = {0, 0, 0}
    vector[index] = 1
    local q = {pose[4], pose[5], pose[6], pose[7]}
    if motion.axis:sub(1, 1) == 'r' then
        local angle = math.rad(motion.speed * motion.direction) * dt
        local turn = {vector[1] * math.sin(angle / 2),
            vector[2] * math.sin(angle / 2), vector[3] * math.sin(angle / 2),
            math.cos(angle / 2)}
        local orientation = motion.frame == 'tool' and multiplyQuaternion(q, turn)
            or multiplyQuaternion(turn, q)
        for i = 1, 4 do pose[i + 3] = orientation[i] end
    else
        if motion.frame == 'tool' then vector = rotateVector(q, vector) end
        local distance = motion.speed * motion.direction * dt / 1000
        for i = 1, 3 do pose[i] = pose[i] + vector[i] * distance end
    end
    local solved = solve(motion.context, pose, motion.commanded, motion.joints)
    if difference(motion.commanded, solved) > math.rad(10) then
        error('La IK cambio bruscamente de postura durante el desplazamiento.')
    end
    checkWrist(motion.commanded, solved)
    for i, joint in ipairs(motion.joints) do
        sim.setJointTargetPosition(joint, solved[i])
    end
    motion.commanded = solved
    motion.pose = pose
end

local function advance()
    local heartbeat = sim.readCustomTableData(sim.handle_scene, HEARTBEAT)
    if heartbeat.id ~= motion.id or
       sim.getSystemTime() - math.max(heartbeat.time or 0, motion.started) > 2.0 then
        stopMotion('error', 'Movimiento detenido: se perdio la comunicacion con Python.')
        return
    end
    if motion.kind == 'jog' then
        local ok, message = pcall(advanceJog)
        if not ok then stopMotion('error', tostring(message)) end
        return
    end
    local destination = motion.path[motion.segment]
    local actual = currentQ(motion.joints)
    if not destination then
        if difference(actual, motion.commanded) < math.rad(1.5) then
            publish(motion.id, 'done', 'Movimiento terminado.')
            motion = nil
        elseif sim.getSystemTime() - motion.started > 120 then
            stopMotion('error', 'El robot no alcanzo la postura final.')
        end
        return
    end
    if difference(actual, motion.commanded) > math.rad(8) then return end
    local origin = motion.path[motion.segment - 1]
    local delta = difference(origin, destination)
    local dt = math.max(0.001, sim.getSimulationTimeStep())
    local increment
    if motion.kind == 'movel' and motion.speed then
        local duration = math.max(motion.linearStep / motion.speed,
            motion.angularStep / 0.8, delta / 1.2)
        increment = duration < 1e-8 and 1 or dt / duration
    else
        increment = delta < 1e-8 and 1 or (motion.speed or 0.8) * dt / delta
    end
    motion.fraction = math.min(1, motion.fraction + increment)
    for i, joint in ipairs(motion.joints) do
        local target = origin[i] + motion.fraction * (destination[i] - origin[i])
        sim.setJointTargetPosition(joint, target)
        motion.commanded[i] = target
    end
    if motion.fraction == 1 then
        motion.segment = motion.segment + 1
        motion.fraction = 0
    end
    if sim.getSystemTime() - motion.started > 120 then
        stopMotion('error', 'Movimiento detenido por tiempo de espera.')
    end
end

function sysCall_init()
    sim.writeCustomTableData(sim.handle_scene, TAG, {version = 1, speed = true})
    sim.writeCustomTableData(sim.handle_scene, COMMAND, {})
    publish('', 'idle', '')
end

function sysCall_beforeSimulation()
    motion = nil
    sim.writeCustomTableData(sim.handle_scene, COMMAND, {})
    publish('', 'idle', '')
end

function sysCall_actuation()
    local command = sim.readCustomTableData(sim.handle_scene, COMMAND)
    if command.id and command.id ~= '' then
        sim.writeCustomTableData(sim.handle_scene, COMMAND, {})
        if command.kind == 'cancel' then
            if motion and motion.id == command.id then stopMotion('error', 'Movimiento cancelado.') end
        elseif motion then
            publish(command.id, 'error', 'El robot ya esta ejecutando otro movimiento.')
        else
            publish(command.id, 'planning', 'Calculando trayectoria en CoppeliaSim.')
            local ok, result = pcall(command.kind == 'jog' and prepareJog or prepare, command)
            if ok then
                motion = result
                publish(command.id, 'running', 'Robot en movimiento.')
            else
                publish(command.id, 'error', tostring(result))
            end
        end
    end
    if motion then advance() end
end

function sysCall_afterSimulation()
    stopMotion('error', 'La simulacion se detuvo.')
    sim.writeCustomTableData(sim.handle_scene, COMMAND, {})
end

function sysCall_cleanup()
    stopMotion('error', 'El controlador se cerro.')
    sim.writeCustomTableData(sim.handle_scene, TAG, {})
end
