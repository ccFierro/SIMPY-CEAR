-- Script de personalizacion independiente para una escena CEAR RoboLab.
-- Descubre cintas y sensores compatibles. No reemplaza el Lua de la ventosa.
-- Funciona con la simulacion detenida; guardar la escena para conservar los canales.
sim = require('sim')

local CONFIG = {
    robots = {
        {path = '/UR3', name = 'UR3'},
    },
    maxConveyorSpeedMmS = 500, -- limite de magnitud; AO usa mm/s con signo
    conveyorOverrides = {
        -- ['/conveyor[1]'] = {name = 'Salida'},
    },
    ignoredSensors = {
        ['/LaserSensor'] = true, -- ya lo publica el Lua de ventosa como DI_00
    },
    externalSignals = {
        -- Senales atendidas por el Lua de ventosa; solo se publican sus etiquetas.
        {name = 'DO_00', label = 'Ventosa: activar', direction = 'output'},
        {name = 'DI_00', label = 'Laser: detecta objeto', direction = 'input'},
        {name = 'DI_01', label = 'Ventosa: pieza sujeta', direction = 'input'},
    },
}

local conveyors = {}
local lineSensors = {}
local MANIFEST = 'customData.CEAR_RoboLab'
local DEVICE_TAG = 'customData.CEAR_RoboLab_io'
local manifestRefreshes = 0
local lastInventorySignature = nil
local nextInventoryScan = 0

local function readTag(handle)
    local packed = sim.getBufferProperty(handle, DEVICE_TAG, {noError = true})
    if not packed then return nil end
    local ok, tag = pcall(sim.unpackTable, packed)
    return ok and type(tag) == 'table' and tag or nil
end

local function saveTag(device)
    local tag = {schema = 2, kind = device.kind,
        uid = sim.getStringProperty(device.handle, 'persistentUid'), name = device.name,
        analog = device.analog, feedback = device.feedback, input = device.input}
    local old = readTag(device.handle)
    if old and old.schema == tag.schema and old.kind == tag.kind and
       old.uid == tag.uid and old.name == tag.name and
       old.analog == tag.analog and old.feedback == tag.feedback and
       old.input == tag.input then return end
    sim.setBufferProperty(device.handle, DEVICE_TAG, sim.packTable(tag))
end

local function discover()
    local devices = {}
    for _, handle in ipairs(sim.getObjectsInTree(sim.handle_scene, sim.object_dummy_type, 0)) do
        local state = sim.readCustomTableData(handle, '__state__')
        if type(state) == 'table' and type(state.vel) == 'number' and
           type(state.pos) == 'number' then
            local path = sim.getObjectAlias(handle, 2)
            local override = CONFIG.conveyorOverrides[path] or {}
            if not override.ignore then
                devices[#devices + 1] = {handle = handle, path = path,
                    kind = 'conveyor', name = override.name or path:match('[^/]+$'),
                    override = override}
            end
        end
    end
    for _, handle in ipairs(sim.getObjectsInTree(sim.handle_scene, sim.object_proximitysensor_type, 0)) do
        local path = sim.getObjectAlias(handle, 2)
        local robotSensor = false
        for _, robot in ipairs(CONFIG.robots) do
            if path == robot.path or path:sub(1, #robot.path + 1) == robot.path .. '/' then
                robotSensor = true
                break
            end
        end
        if not robotSensor and not CONFIG.ignoredSensors[path] then
            devices[#devices + 1] = {handle = handle, path = path,
                kind = 'lineSensor', name = path:match('[^/]+$')}
        end
    end
    table.sort(devices, function(a, b) return a.path < b.path end)
    return devices
end

local function nextSignal(used, prefix)
    for number = 0, 99 do
        local name = string.format('%s_%02d', prefix, number)
        if not used[name] then used[name] = true; return name end
    end
    error('CEAR IO: no quedan canales libres para ' .. prefix)
end

local function assign(devices)
    local used = {}
    for _, signal in ipairs(CONFIG.externalSignals) do used[signal.name] = true end
    -- Reservar primero los canales anteriores: agregar un equipo no renumera los existentes.
    for _, device in ipairs(devices) do
        local tag = readTag(device.handle)
        if tag and (tag.schema == 1 or tag.schema == 2) and tag.kind == device.kind and
           tag.uid == sim.getStringProperty(device.handle, 'persistentUid') then
            if device.kind == 'conveyor' then
                -- Migrar etiquetas antiguas DO/DI: conservar DI, reemplazar DO por AO.
                if type(tag.analog) == 'string' and tag.analog:match('^AO_%d%d$') and
                   not used[tag.analog] then
                    device.analog = tag.analog
                    used[tag.analog] = true
                end
                if type(tag.feedback) == 'string' and tag.feedback:match('^DI_%d%d$') and
                   not used[tag.feedback] then
                    device.feedback = tag.feedback
                    used[tag.feedback] = true
                end
                if type(tag.command) == 'string' and tag.command:match('^DO_%d%d$') and
                   not used[tag.command] then
                    sim.clearInt32Signal(tag.command)
                end
            else
                if type(tag.input) == 'string' and tag.input:match('^DI_%d%d$') and
                   not used[tag.input] then
                    device.input = tag.input
                    used[tag.input] = true
                end
            end
            device.name = tag.name or device.name
        end
    end
    for _, device in ipairs(devices) do
        if device.kind == 'conveyor' then
            device.analog = device.analog or nextSignal(used, 'AO')
            device.feedback = device.feedback or nextSignal(used, 'DI')
            device.name = device.override.name or device.name
            conveyors[#conveyors + 1] = device
        else
            device.input = device.input or nextSignal(used, 'DI')
            lineSensors[#lineSensors + 1] = device
        end
        saveTag(device)
    end
end

local function addUnique(items, item, key)
    for _, existing in ipairs(items) do
        if existing[key] == item[key] then
            for field, value in pairs(item) do existing[field] = value end
            return
        end
    end
    items[#items + 1] = item
end

local function publishManifest()
    local packed = sim.getBufferProperty(sim.handle_scene, MANIFEST, {noError = true})
    local ok, manifest = pcall(function() return packed and sim.unpackTable(packed) or {} end)
    if not ok or type(manifest) ~= 'table' or manifest.schema ~= 1 then manifest = {schema = 1} end
    local function withoutOwn(items)
        local result = {}
        for _, item in ipairs(type(items) == 'table' and items or {}) do
            if item.source ~= 'scene_io' then result[#result + 1] = item end
        end
        return result
    end
    manifest.robots = withoutOwn(manifest.robots)
    manifest.sensors = withoutOwn(manifest.sensors)
    manifest.signals = withoutOwn(manifest.signals)
    for _, robot in ipairs(CONFIG.robots) do
        addUnique(manifest.robots, {path = robot.path, name = robot.name, source = 'scene_io'}, 'path')
    end
    for _, signal in ipairs(CONFIG.externalSignals) do
        addUnique(manifest.signals,
            {name = signal.name, label = signal.label,
             direction = signal.direction, source = 'scene_io'}, 'name')
    end
    for _, conveyor in ipairs(conveyors) do
        addUnique(manifest.signals,
            {name = conveyor.analog, label = conveyor.name .. ': velocidad (mm/s)',
             direction = 'output', unit = 'mm/s', source = 'scene_io'}, 'name')
        addUnique(manifest.signals,
            {name = conveyor.feedback, label = conveyor.name .. ': en movimiento',
             direction = 'input', source = 'scene_io'}, 'name')
    end
    for _, sensor in ipairs(lineSensors) do
        addUnique(manifest.sensors,
            {path = sensor.path, name = sensor.name, source = 'scene_io'}, 'path')
        addUnique(manifest.signals,
            {name = sensor.input, label = sensor.name .. ': detecta pieza',
             direction = 'input', source = 'scene_io'}, 'name')
    end
    sim.setBufferProperty(sim.handle_scene, MANIFEST, sim.packTable(manifest))
end

local function refreshInventory(force)
    local devices = discover()
    local names = {}
    for _, device in ipairs(devices) do
        names[#names + 1] = device.path .. ':' ..
            sim.getStringProperty(device.handle, 'persistentUid')
    end
    local signature = table.concat(names, '|')
    if not force and signature == lastInventorySignature then return end
    local oldConveyors, oldSensors = conveyors, lineSensors
    conveyors, lineSensors = {}, {}
    assign(devices)
    local current = {}
    for _, device in ipairs(conveyors) do
        current[device.analog], current[device.feedback] = true, true
    end
    for _, device in ipairs(lineSensors) do current[device.input] = true end
    for _, device in ipairs(oldConveyors) do
        if not current[device.analog] then sim.clearFloatSignal(device.analog) end
        if not current[device.feedback] then sim.clearInt32Signal(device.feedback) end
    end
    for _, device in ipairs(oldSensors) do
        if not current[device.input] then sim.clearInt32Signal(device.input) end
    end
    if sim.getSimulationState() == sim.simulation_stopped then
        for _, device in ipairs(conveyors) do
            sim.setFloatSignal(device.analog, 0)
            sim.setInt32Signal(device.feedback, 0)
        end
        for _, device in ipairs(lineSensors) do sim.setInt32Signal(device.input, 0) end
    end
    publishManifest()
    lastInventorySignature = signature
end

local function resetOutputs()
    for _, conveyor in ipairs(conveyors) do
        sim.setFloatSignal(conveyor.analog, 0)
        sim.setInt32Signal(conveyor.feedback, 0)
        sim.writeCustomTableData(conveyor.handle, '__ctrl__', {vel = 0})
    end
    for _, sensor in ipairs(lineSensors) do
        sim.setInt32Signal(sensor.input, 0)
    end
end

local function synchronizeRobotTargets()
    -- Mantener la postura guardada en la escena al iniciar, sin mover el robot.
    for _, robot in ipairs(CONFIG.robots) do
        local root = sim.getObject(robot.path, {noError = true})
        if root and root ~= -1 then
            local joints = sim.getObjectsInTree(root, sim.object_joint_type, 0)
            if #joints == 6 then
                for _, joint in ipairs(joints) do
                    sim.setJointTargetPosition(joint, sim.getJointPosition(joint))
                end
            end
        end
    end
end

function sysCall_init()
    refreshInventory(true)
    resetOutputs()
end

function sysCall_nonSimulation()
    local now = sim.getSystemTime()
    if now >= nextInventoryScan then
        refreshInventory(false)
        nextInventoryScan = now + 1
    end
end

function sysCall_beforeSimulation()
    refreshInventory(true)
    resetOutputs()
    synchronizeRobotTargets()
    manifestRefreshes = 2
end

function sysCall_actuation()
    for _, conveyor in ipairs(conveyors) do
        local mm_s = tonumber(sim.getFloatSignal(conveyor.analog)) or 0
        mm_s = math.max(-CONFIG.maxConveyorSpeedMmS,
            math.min(CONFIG.maxConveyorSpeedMmS, mm_s))
        sim.writeCustomTableData(conveyor.handle, '__ctrl__',
            {vel = mm_s / 1000})
    end
end

function sysCall_sensing()
    for _, conveyor in ipairs(conveyors) do
        local state = sim.readCustomTableData(conveyor.handle, '__state__')
        local velocity = type(state) == 'table' and tonumber(state.vel) or 0
        sim.setInt32Signal(conveyor.feedback, math.abs(velocity or 0) > 0.001 and 1 or 0)
    end
    for _, sensor in ipairs(lineSensors) do
        local detected = sim.readProximitySensor(sensor.handle)
        sim.setInt32Signal(sensor.input, detected == 1 and 1 or 0)
    end
    -- Repetir brevemente tras init por si el Lua de ventosa publico despues.
    if manifestRefreshes > 0 then
        publishManifest()
        manifestRefreshes = manifestRefreshes - 1
    end
end

function sysCall_cleanup()
    resetOutputs()
end

function sysCall_afterSimulation()
    for _, conveyor in ipairs(conveyors) do
        sim.writeCustomTableData(conveyor.handle, '__ctrl__', {vel = 0})
        sim.setFloatSignal(conveyor.analog, 0)
        sim.setInt32Signal(conveyor.feedback, 0)
    end
    for _, sensor in ipairs(lineSensors) do
        sim.setInt32Signal(sensor.input, 0)
    end
end
