export const cafeOpen = m => (m?.scenes || []).includes('roca-cafe');   // el café abre con la escena en la que se aparta la roca de la plaza
// =====================================================================
// LA ALDEA — cuatro zonas conectadas por los bordes, con movimiento libre, colisiones por máscara y PNJ interactivos.
// Coordenadas en píxeles de mundo (768×515 por zona). La cámara (600×408) sigue al jugador.
// =====================================================================
export const HUB = {
  plaza: {
    img: 'client/assets/hub/plaza.png', mask: 'client/assets/hub/plaza_mask.png', spawn: { x: 384, y: 300 },
    // al completar el Bosque Frondoso se abre el camino de la derecha, a la Fuente de la Evolución
    // la entrada del Café de Spinda está tapada por una roca hasta la escena que la aparta; con el Bosque superado, además, el camino a la Fuente
    variants: [
      { img: 'client/assets/hub/plaza_fuente_roca.png', mask: 'client/assets/hub/plaza_fuente_roca_mask.png', when: m => (m.cleared || []).includes('bosque') && !cafeOpen(m) },
      { img: 'client/assets/hub/plaza_roca.png', mask: 'client/assets/hub/plaza_roca_mask.png', when: m => !cafeOpen(m) },
      { img: 'client/assets/hub/plaza_fuente.png', mask: 'client/assets/hub/plaza_fuente_mask.png', when: m => (m.cleared || []).includes('bosque') },
    ],
    // Salidas: franjas junto al borde (o la puerta). Al entrar en ellas cambias de zona.
    exits: [
      { rect: [0, 225, 22, 305], to: 'mercado', at: { x: 722, y: 288 } },
      { rect: [746, 230, 768, 310], to: 'fuente', at: { x: 50, y: 290 } },   // camino de la derecha: la Fuente de la Evolución
      { rect: [335, 493, 430, 515], to: 'aldea', at: { x: 384, y: 48 } },
      { rect: [345, 150, 425, 200], to: 'gremio', at: { x: 405, y: 466 }, label: 'Puerta del gremio' },
    ],
    npcs: [
      { id: 'chatot', x: 446, y: 226, facing: [-1, 1], talk: 'chatot_intro', intro: true },                          // solo al empezar: te recibe en la entrada
      { id: 'murkrow', x: 315, y: 152, facing: [0, 1], talk: 'murkrow', fixedFacing: true, still: true, reach: 92 },   // el cartero del gremio, posado encima del buzón (quieto, de frente; se le habla desde todo el buzón)
    ],
    signs: [ { rect: [70, 170, 130, 230], text: 'Mercado de Kecleon ←' }, { rect: [440, 405, 500, 465], text: '↓ Aldea · Salida a las mazmorras' },
      // entrada al Café de Spinda (bajo tierra): dibujada por tools/build-cafe-hole.py; el café aún no está abierto
      { rect: [598, 306, 640, 368], when: m => cafeOpen(m), text: 'Un cartel con la cara de Spinda. Debajo, alguien ha escrito a mano: «Próximamente».' },   // (el cartel solo está con el café abierto)
      { rect: [506, 313, 596, 372], when: m => !cafeOpen(m), text: 'Una roca enorme. Alguien ha dibujado encima, con tiza, una flecha que apunta hacia abajo.' },
      { rect: [534, 326, 596, 368], text: 'Unas escaleras bajan hacia la oscuridad. Se oye a alguien trastear ahí abajo… pero todavía está cerrado.' } ],
  },
  gremio: {
    img: 'client/assets/hub/gremio.png', mask: 'client/assets/hub/gremio_mask.png', spawn: { x: 405, y: 466 },
    exits: [
      { rect: [340, 494, 470, 515], to: 'plaza', at: { x: 384, y: 228 } },                                    // la luz de la salida
      { rect: [174, 210, 228, 226], to: 'descanso', at: { x: 372, y: 288 }, label: 'Subir a la zona de descanso' },   // escalón de abajo de la escalera del hueco
    ],
    npcs: [
      { id: 'chatot', x: 440, y: 206, facing: [0, 1], talk: 'chatot' },                                          // junto al tablón
      { id: 'machamp', x: 278, y: 370, facing: [1, 0], talk: 'machamp', afterScene: 'veteranos', fixedFacing: true, reach: 56 },      // de otro equipo: tranquilo y fuerte
      { id: 'heracross', x: 542, y: 382, facing: [-1, 0], talk: 'heracross', afterScene: 'veteranos', fixedFacing: true, reach: 56 },  // y ruidoso
      { id: 'ampharos', x: 302, y: 298, facing: [1, 0], talk: 'ampharos', afterScene: 'veteranos', fixedFacing: true, reach: 56 },     // y despistada
      { id: 'mawile', x: 546, y: 256, facing: [-1, 1], talk: 'mawile', fixedFacing: true, reach: 44 },          // sobre el felpudo, guardando el despacho
    ],
    hotspots: [ { rect: [300, 190, 480, 236], action: 'board', label: 'Tablón de misiones' } ],
  },
  // Zona de descanso: arriba, en el nido del gremio (se sube por la escalera del interior). Aquí se aparece al volver
  // de cada exploración; si has caído, en una de las camas
  descanso: {
    img: 'client/assets/hub/descanso.png', mask: 'client/assets/hub/descanso_mask.png', spawn: { x: 390, y: 400 },
    // el hueco de la escalera, en diagonal: se entra por su borde delantero (las barandillas chocan)
    exits: [ { poly: [[160, 256], [250, 205], [258, 218], [344, 262], [254, 310]], to: 'gremio', at: { x: 200, y: 252 }, label: 'Bajar al gremio' } ],
    // camas de paja (dónde se despierta al caer) y el punto del suelo al que se sale al levantarse
    beds: [ { x: 116, y: 326, box: [32, 284, 198, 400] }, { x: 146, y: 434, box: [62, 394, 232, 494] },
            { x: 650, y: 326, box: [568, 284, 734, 400] }, { x: 614, y: 434, box: [532, 394, 694, 494] } ],
    npcs: [ { id: 'chansey', x: 522, y: 238, facing: [0, 1], talk: 'chansey', fixedFacing: true, reach: 84, approach: [462, 300, 600, 360] },   // tras el mostrador
            // Smeargle, recuperándose en una cama (dormido hasta que llegan los veteranos)
            { id: 'smeargle', x: 146, y: 436, facing: [1, 1], talk: 'smeargle', afterScene: 'smeargle-vuelve', pose: 'Sleep', poseUntil: 'veteranos', fixedFacing: true, reach: 56 } ],
  },
  // Fuente de la Evolución (a la derecha de la plaza). Hecha con el tileset original de Apple Woods: tools/build-fuente.py.
  // El camino sigue hacia la derecha, pero el bosque aún no deja pasar.
  fuente: {
    img: 'client/assets/hub/fuente.png', mask: 'client/assets/hub/fuente_mask.png', spawn: { x: 60, y: 290 },
    exits: [ { rect: [0, 240, 22, 336], to: 'plaza', at: { x: 730, y: 270 } } ],
    npcs: [ { id: 'rowlet', x: 408, y: 262, facing: [0, 1], talk: 'rowlet', fixedFacing: true, reach: 70 } ],   // «???»: lleva tanto tiempo como el maestro del gremio
    signs: [ { rect: [590, 240, 672, 336], text: 'El bosque es demasiado espeso para seguir… Por ahora.' } ],
  },
  // solo para escenas (no se llega andando): la cima del Monte Acero, con el cielo de tormenta (tools/build-cima.py)
  cima: {
    img: 'client/assets/hub/scene_cima.png', mask: 'client/assets/hub/scene_cima_mask.png', spawn: { x: 384, y: 300 },
    exits: [], npcs: [], signs: [],
  },
  mercado: {
    img: 'client/assets/hub/mercado.png', mask: 'client/assets/hub/mercado_mask.png', spawn: { x: 730, y: 300 },
    exits: [ { rect: [746, 245, 768, 335], to: 'plaza', at: { x: 48, y: 265 } } ],
    npcs: [
      { id: 'kecleon_green', x: 246, y: 313, facing: [1, 1], talk: 'shop', fixedFacing: true, reach: 84 },   // atiende tras el mostrador (que le tapa de cintura para abajo)
      { id: 'kecleon_purple', x: 366, y: 251, facing: [1, 1], talk: 'sell', fixedFacing: true, reach: 84 },
      { id: 'kangaskhan', x: 540, y: 235, facing: [-1, 1], talk: 'storage', fixedFacing: true },
      { id: 'sneasel', x: 330, y: 300, facing: [1, 1], talk: 'sneasel', afterScene: 'recien-llegado', reach: 34 },   // el recién llegado: se queda en la aldea
      { id: 'sableye', x: 452, y: 418, facing: [1, 0], talk: 'sableye_gulpin', untilRank: 1, reach: 40, idle: true },   // (está trabajando: se mueve)   // Sableye, ayudando a Gulpin con su cabaña (hasta Bronce)
      { id: 'gulpin', x: 546, y: 392, facing: [-1, 1], talk: 'gulpin', fixedFacing: true, reach: 120, approach: [436, 394, 508, 442] },   // dentro de la cabaña, en la entrada // en la puerta de la cabaña: solo se le habla desde delante
    ],
    // Capas de primer plano: los mostradores (con su poste delantero) se dibujan por encima de los Kecleon, que atienden detrás
    fg: [
      { poly: [[184, 288], [191, 288], [191, 319], [270, 281], [289, 292], [289, 313], [196, 344], [191, 342], [191, 358], [184, 358]], sortY: 330 },
      { poly: [[316, 215], [324, 215], [324, 256], [401, 212], [421, 224], [421, 245], [325, 290], [316, 288]], sortY: 268 },
    ],
    // Capas de primer plano: mostradores y frente de la cabaña se dibujan por encima de quien esté detrás
    // mostradores, toldos (los Kecleon quedan bajo el toldo, dentro del puesto) y frente de la cabaña
  },
  aldea: {
    img: 'client/assets/hub/aldea.png', mask: 'client/assets/hub/aldea_mask.png', spawn: { x: 384, y: 48 },
    exits: [
      { rect: [345, 0, 425, 22], to: 'plaza', at: { x: 384, y: 468 } },
      { rect: [345, 493, 425, 515], action: 'dungeons', label: 'Salida a las mazmorras', back: { x: 384, y: 470 } },
    ],
    npcs: [ { id: 'wobbuffet', x: 250, y: 300, facing: [0, 1], talk: 'wobbuffet', idle: true } ],   // su balanceo es su gracia
    wanderers: 4, // Pokémon sueltos paseando (sin función por ahora)
  },
};
export const VIEW = { w: 600, h: 408 };
