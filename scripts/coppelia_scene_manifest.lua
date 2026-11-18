-- Copiar este bloque dentro de sysCall_init() del script de ventosa ya existente,
-- después de crear s y, si existe, laser. No mueve ningún objeto.
-- Ajustar el robot y las señales para cada escena que se entregue a estudiantes.
local manifest = {
    schema = 1,
    robots = {
        {path = '/UR3', name = 'UR3'}
    },
    sensors = {
        {path = sim.getObjectAlias(s, 2), name = 'Contacto de ventosa'}
    },
    signals = {
        {name = 'DI_01', label = 'Ventosa sujeta objeto', direction = 'input'},
        {name = 'DO_00', label = 'Activar ventosa', direction = 'output'}
    }
}
if laser and laser ~= -1 then
    table.insert(manifest.sensors, {path = sim.getObjectAlias(laser, 2), name = 'Láser de presencia'})
    table.insert(manifest.signals, {name = 'DI_00', label = 'Láser detecta objeto', direction = 'input'})
end
sim.setBufferProperty(sim.handle_scene, 'customData.CEAR_RoboLab', sim.packTable(manifest))
