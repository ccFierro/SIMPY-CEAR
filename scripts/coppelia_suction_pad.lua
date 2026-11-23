-- Script del suction pad. Los sensores laser de la escena los gestiona CEAR_SceneIO.
sim = require('sim')
attachedShape = nil

local function releaseLink()
    sim.setLinkDummy(l, -1)
    sim.setObjectParent(l, b, true)
    sim.setObjectMatrix(l, sim.getObjectMatrix(l2))
end

function sysCall_init()
    s = sim.getObject('../Sensor')
    l = sim.getObject('../LoopClosureDummy1')
    l2 = sim.getObject('../LoopClosureDummy2')
    b = sim.getObject('..')

    infiniteStrength = true
    maxPullForce = 3
    maxShearForce = 1
    maxPeelTorque = 0.1

    releaseLink()
    sim.setInt32Signal('DI_01', 0)
end

function sysCall_cleanup()
    releaseLink()
    sim.setInt32Signal('DI_01', 0)
end

function sysCall_sensing()
    local suctionCmd = sim.getInt32Signal('DO_00') == 1
    local detectedShape = nil
    local index = 0

    while true do
        local shape = sim.getObjects(index, sim.sceneobject_shape)
        if shape == -1 then break end
        if shape ~= b and sim.checkProximitySensor(s, shape) == 1 then
            detectedShape = shape
            break
        end
        index = index + 1
    end

    if suctionCmd and detectedShape and attachedShape == nil then
        attachedShape = detectedShape
        sim.setObjectParent(l, b, true)
        sim.setObjectMatrix(l, sim.getObjectMatrix(l2))
        sim.setObjectParent(l, attachedShape, true)
        sim.setLinkDummy(l, l2)
        sim.setInt32Signal('DI_01', 1)
        sim.addLog(sim.verbosity_scriptinfos,
            '[SuctionPad] OBJECT ATTACHED: ' .. sim.getObjectAlias(attachedShape, 1))
    end

    if not suctionCmd and attachedShape ~= nil then
        releaseLink()
        sim.setInt32Signal('DI_01', 0)
        sim.addLog(sim.verbosity_scriptinfos,
            '[SuctionPad] OBJECT RELEASED: ' .. sim.getObjectAlias(attachedShape, 1))
        attachedShape = nil
    end
end
