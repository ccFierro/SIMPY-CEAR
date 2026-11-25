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
        ['/SensorSalida'] = true, -- uso interno: reposicion de cubos
    },
    recycle = {
        exitSensor = '/SensorSalida',
        entryPoint = '/PuntoEntrada', -- centro del cubo sobre la cinta
        cubeNamePattern = '^icubo%[%d+%]$', -- detecta automaticamente icubo[0], icubo[1], ...
        entryClearance = 0.075, -- metros entre centros antes de reponer otro cubo
    },
    colorDisplay = {enabled = true, sensorPath = '/visionSensor'},
    externalSignals = {
        -- Senales atendidas por el Lua de ventosa; solo se publican sus etiquetas.
        {name = 'DO_00', label = 'Ventosa: activar', direction = 'output'},
        {name = 'DI_01', label = 'Ventosa: pieza sujeta', direction = 'input'},
    },
}

local conveyors = {}
local lineSensors = {}
local colorSensors = {}
local MANIFEST = 'customData.CEAR_RoboLab'
local DEVICE_TAG = 'customData.CEAR_RoboLab_io'
local manifestRefreshes = 0
local lastInventorySignature = nil
local nextInventoryScan = 0
local recycler = {sensor = nil, entry = nil, cubes = {}, rotations = {}}
local colorUi, colorUiPlugin = nil, nil
local nextColorUiUpdate = 0

function colorDisplayClosed(handle)
    if colorUiPlugin and handle == colorUi then
        colorUiPlugin.destroy(handle)
        colorUi = false -- no abrirla otra vez hasta recargar la escena
    end
end

local function displaySensor()
    for _, sensor in ipairs(colorSensors) do
        if sensor.path == CONFIG.colorDisplay.sensorPath then return sensor end
    end
    return colorSensors[1]
end

local function ensureColorDisplay()
    if not CONFIG.colorDisplay.enabled or colorUi ~= nil or not displaySensor() then return end
    local available, plugin = pcall(require, 'simUI')
    if not available then
        sim.addLog(sim.verbosity_warnings, '[CEAR] Pantalla RGB no disponible: falta simUI.')
        colorUi = false
        return
    end
    local xml = [[<ui title="Sensor de color RGB" closeable="true" on-close="colorDisplayClosed" layout="vbox">
        <label id="1" text="Esperando lectura" />
        <group layout="hbox" flat="true" content-margins="0,0,0,0"><label id="2" text="R: 0 / 255" /><progressbar id="3" minimum="0" maximum="255" inverted="false" text-visible="false" style="QProgressBar::chunk {background-color: #dc6464;}" /></group>
        <group layout="hbox" flat="true" content-margins="0,0,0,0"><label id="4" text="G: 0 / 255" /><progressbar id="5" minimum="0" maximum="255" inverted="false" text-visible="false" style="QProgressBar::chunk {background-color: #35a981;}" /></group>
        <group layout="hbox" flat="true" content-margins="0,0,0,0"><label id="6" text="B: 0 / 255" /><progressbar id="7" minimum="0" maximum="255" inverted="false" text-visible="false" style="QProgressBar::chunk {background-color: #578ce0;}" /></group>
        <label id="8" text="Inicia la simulacion para leer el sensor" />
    </ui>]]
    local ok, handle = pcall(plugin.create, xml)
    if ok then
        colorUiPlugin, colorUi = plugin, handle
    else
        sim.addLog(sim.verbosity_warnings, '[CEAR] No se pudo abrir la pantalla RGB: ' .. tostring(handle))
        colorUi = false
    end
end

local function updateColorDisplay(sensor, red, green, blue)
    if not colorUi or colorUi == false or sensor ~= displaySensor() then return end
    local now = sim.getSystemTime()
    if now < nextColorUiUpdate then return end
    nextColorUiUpdate = now + 0.15
    local values = {red, green, blue}
    local labels = {'R', 'G', 'B'}
    local signals = {sensor.red, sensor.green, sensor.blue}
    local maximum, minimum, index = -1, 256, 1
    for i, value in ipairs(values) do
        local level = math.max(0, math.min(255, math.floor(value + 0.5)))
        colorUiPlugin.setLabelText(colorUi, i * 2, labels[i] .. ' (' .. signals[i] .. '): ' .. level .. ' / 255')
        colorUiPlugin.setProgress(colorUi, i * 2 + 1, level)
        if level > maximum then maximum, index = level, i end
        if level < minimum then minimum = level end
    end
    colorUiPlugin.setLabelText(colorUi, 1, sensor.name)
    local dominant = maximum - minimum >= 25 and labels[index] or 'sin dominante'
    colorUiPlugin.setLabelText(colorUi, 8, 'Canal dominante: ' .. dominant)
end

local function prepareRecycler()
    recycler = {sensor = sim.getObject(CONFIG.recycle.exitSensor, {noError = true}),
        entry = sim.getObject(CONFIG.recycle.entryPoint, {noError = true}),
        cubes = {}, rotations = {}}
    if not recycler.sensor or recycler.sensor == -1 or
       not recycler.entry or recycler.entry == -1 then
        sim.addLog(sim.verbosity_warnings,
            '[CEAR] Reciclaje desactivado: falta SensorSalida o PuntoEntrada.')
        return
    end
    for _, handle in ipairs(sim.getObjectsInTree(sim.handle_scene, sim.object_shape_type, 0)) do
        local path = sim.getObjectAlias(handle, 2)
        local name = path:match('[^/]+$')
        if name and name:match(CONFIG.recycle.cubeNamePattern) then
            recycler.cubes[#recycler.cubes + 1] = handle
            local pose = sim.getObjectPose(handle, sim.handle_world)
            recycler.rotations[handle] = {pose[4], pose[5], pose[6], pose[7]}
        end
    end
end

local function recycleCubes()
    if not recycler.sensor or recycler.sensor == -1 or
       not recycler.entry or recycler.entry == -1 then return end
    local entryPose = sim.getObjectPose(recycler.entry, sim.handle_world)
    local clearance2 = CONFIG.recycle.entryClearance ^ 2
    for _, cube in ipairs(recycler.cubes) do
        if sim.checkProximitySensor(recycler.sensor, cube) == 1 then
            local free = true
            for _, other in ipairs(recycler.cubes) do
                if other ~= cube then
                    local position = sim.getObjectPosition(other, sim.handle_world)
                    local dx = position[1] - entryPose[1]
                    local dy = position[2] - entryPose[2]
                    if dx * dx + dy * dy < clearance2 then
                        free = false
                        break
                    end
                end
            end
            if free then
                local rotation = recycler.rotations[cube]
                sim.setObjectPose(cube, {entryPose[1], entryPose[2], entryPose[3],
                    rotation[1], rotation[2], rotation[3], rotation[4]}, sim.handle_world)
            end
            break -- reponer a lo sumo un cubo por paso de simulacion
        end
    end
end

local function readTag(handle)
    local packed = sim.getBufferProperty(handle, DEVICE_TAG, {noError = true})
    if not packed then return nil end
    local ok, tag = pcall(sim.unpackTable, packed)
    return ok and type(tag) == 'table' and tag or nil
end

local function saveTag(device)
    local tag = {schema = 3, kind = device.kind,
        uid = sim.getStringProperty(device.handle, 'persistentUid'), name = device.name,
        analog = device.analog, input = device.input,
        red = device.red, green = device.green, blue = device.blue}
    local old = readTag(device.handle)
    if old and old.schema == tag.schema and old.kind == tag.kind and
       old.uid == tag.uid and old.name == tag.name and
       old.analog == tag.analog and old.input == tag.input and
       old.red == tag.red and old.green == tag.green and old.blue == tag.blue then return end
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
    for _, handle in ipairs(sim.getObjectsInTree(sim.handle_scene, sim.object_visionsensor_type, 0)) do
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
                kind = 'colorSensor', name = path:match('[^/]+$')}
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
        if tag and (tag.schema == 1 or tag.schema == 2 or tag.schema == 3) and tag.kind == device.kind and
           tag.uid == sim.getStringProperty(device.handle, 'persistentUid') then
            if device.kind == 'conveyor' then
                -- Conservar AO; retirar la antigua DI de marcha si existe.
                if type(tag.analog) == 'string' and tag.analog:match('^AO_%d%d$') and
                   not used[tag.analog] then
                    device.analog = tag.analog
                    used[tag.analog] = true
                end
                if type(tag.feedback) == 'string' and tag.feedback:match('^DI_%d%d$') and
                   not used[tag.feedback] then
                    sim.clearInt32Signal(tag.feedback)
                end
                if type(tag.command) == 'string' and tag.command:match('^DO_%d%d$') and
                   not used[tag.command] then
                    sim.clearInt32Signal(tag.command)
                end
            elseif device.kind == 'lineSensor' then
                if type(tag.input) == 'string' and tag.input:match('^DI_%d%d$') and
                   not used[tag.input] then
                    device.input = tag.input
                    used[tag.input] = true
                end
            elseif device.kind == 'colorSensor' then
                for _, channel in ipairs({'red', 'green', 'blue'}) do
                    local name = tag[channel]
                    if type(name) == 'string' and name:match('^AI_%d%d$') and not used[name] then
                        device[channel] = name
                        used[name] = true
                    end
                end
            end
            device.name = tag.name or device.name
        end
    end
    for _, device in ipairs(devices) do
        if device.kind == 'conveyor' then
            device.analog = device.analog or nextSignal(used, 'AO')
            device.name = device.override.name or device.name
            conveyors[#conveyors + 1] = device
        elseif device.kind == 'lineSensor' then
            device.input = device.input or nextSignal(used, 'DI')
            lineSensors[#lineSensors + 1] = device
        else
            device.red = device.red or nextSignal(used, 'AI')
            device.green = device.green or nextSignal(used, 'AI')
            device.blue = device.blue or nextSignal(used, 'AI')
            colorSensors[#colorSensors + 1] = device
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
    end
    for _, sensor in ipairs(lineSensors) do
        addUnique(manifest.sensors,
            {path = sensor.path, name = sensor.name, source = 'scene_io'}, 'path')
        addUnique(manifest.signals,
            {name = sensor.input, label = sensor.name .. ': detecta pieza',
             direction = 'input', source = 'scene_io'}, 'name')
    end
    for _, sensor in ipairs(colorSensors) do
        addUnique(manifest.sensors,
            {path = sensor.path, name = sensor.name, source = 'scene_io'}, 'path')
        for _, channel in ipairs({{'red', 'rojo'}, {'green', 'verde'}, {'blue', 'azul'}}) do
            addUnique(manifest.signals,
                {name = sensor[channel[1]], label = sensor.name .. ': promedio ' .. channel[2],
                 direction = 'input', source = 'scene_io'}, 'name')
        end
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
    local oldConveyors, oldSensors, oldColorSensors = conveyors, lineSensors, colorSensors
    conveyors, lineSensors, colorSensors = {}, {}, {}
    assign(devices)
    local current = {}
    for _, device in ipairs(conveyors) do
        current[device.analog] = true
    end
    for _, device in ipairs(lineSensors) do current[device.input] = true end
    for _, device in ipairs(colorSensors) do
        current[device.red], current[device.green], current[device.blue] = true, true, true
    end
    for _, device in ipairs(oldConveyors) do
        if not current[device.analog] then sim.clearFloatSignal(device.analog) end
    end
    for _, device in ipairs(oldSensors) do
        if not current[device.input] then sim.clearInt32Signal(device.input) end
    end
    for _, device in ipairs(oldColorSensors) do
        for _, channel in ipairs({device.red, device.green, device.blue}) do
            if not current[channel] then sim.clearFloatSignal(channel) end
        end
    end
    if sim.getSimulationState() == sim.simulation_stopped then
        for _, device in ipairs(conveyors) do
            sim.setFloatSignal(device.analog, 0)
        end
        for _, device in ipairs(lineSensors) do sim.setInt32Signal(device.input, 0) end
        for _, device in ipairs(colorSensors) do
            sim.setFloatSignal(device.red, 0)
            sim.setFloatSignal(device.green, 0)
            sim.setFloatSignal(device.blue, 0)
        end
    end
    publishManifest()
    lastInventorySignature = signature
    ensureColorDisplay()
end

local function resetOutputs()
    for _, conveyor in ipairs(conveyors) do
        sim.setFloatSignal(conveyor.analog, 0)
        sim.writeCustomTableData(conveyor.handle, '__ctrl__', {vel = 0})
    end
    for _, sensor in ipairs(lineSensors) do
        sim.setInt32Signal(sensor.input, 0)
    end
    for _, sensor in ipairs(colorSensors) do
        sim.setFloatSignal(sensor.red, 0)
        sim.setFloatSignal(sensor.green, 0)
        sim.setFloatSignal(sensor.blue, 0)
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
    prepareRecycler()
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

local function averageCenterRgb(handle)
    local ok, image, resolution = pcall(sim.getVisionSensorImg, handle)
    if not ok or not image or type(resolution) ~= 'table' then
        return 0, 0, 0
    end
    local unpacked, pixels = pcall(sim.unpackUInt8Table, image)
    if not unpacked or type(pixels) ~= 'table' then return 0, 0, 0 end
    local width, height = resolution[1], resolution[2]
    if not width or not height or #pixels < width * height * 3 then return 0, 0, 0 end
    local x0, x1 = math.floor(width / 4), math.ceil(width * 3 / 4) - 1
    local y0, y1 = math.floor(height / 4), math.ceil(height * 3 / 4) - 1
    local red, green, blue, count = 0, 0, 0, 0
    for y = y0, y1 do
        for x = x0, x1 do
            local i = (y * width + x) * 3 + 1
            local r, g, b = pixels[i], pixels[i + 1], pixels[i + 2]
            red, green, blue, count = red + r, green + g, blue + b, count + 1
        end
    end
    return red / count, green / count, blue / count
end

function sysCall_sensing()
    recycleCubes()
    for _, sensor in ipairs(lineSensors) do
        local detected = sim.readProximitySensor(sensor.handle)
        sim.setInt32Signal(sensor.input, detected == 1 and 1 or 0)
    end
    for _, sensor in ipairs(colorSensors) do
        local red, green, blue = averageCenterRgb(sensor.handle)
        sim.setFloatSignal(sensor.red, red)
        sim.setFloatSignal(sensor.green, green)
        sim.setFloatSignal(sensor.blue, blue)
        updateColorDisplay(sensor, red, green, blue)
    end
    -- Repetir brevemente tras init por si el Lua de ventosa publico despues.
    if manifestRefreshes > 0 then
        publishManifest()
        manifestRefreshes = manifestRefreshes - 1
    end
end

function sysCall_cleanup()
    resetOutputs()
    if colorUi and colorUi ~= false then colorUiPlugin.destroy(colorUi) end
    colorUi = nil
end

function sysCall_afterSimulation()
    for _, conveyor in ipairs(conveyors) do
        sim.writeCustomTableData(conveyor.handle, '__ctrl__', {vel = 0})
        sim.setFloatSignal(conveyor.analog, 0)
    end
    for _, sensor in ipairs(lineSensors) do
        sim.setInt32Signal(sensor.input, 0)
    end
    for _, sensor in ipairs(colorSensors) do
        sim.setFloatSignal(sensor.red, 0)
        sim.setFloatSignal(sensor.green, 0)
        sim.setFloatSignal(sensor.blue, 0)
    end
    if colorUi and colorUi ~= false then
        colorUiPlugin.setLabelText(colorUi, 8, 'Simulacion detenida')
    end
end
