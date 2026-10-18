// Test de personalidad, como en Mundo Misterioso: una reserva de preguntas de la que cada partida saca unas
// cuantas al azar. Cada respuesta suma puntos a las naturalezas con las que encaja y resta a la opuesta;
// gana la naturaleza con más puntos. El servidor elige las preguntas y puntúa: el cliente sólo muestra.
export const NATURES = {
  valiente:  { name: 'Valiente', starters: ['charmander', 'cyndaquil', 'machop', 'magby'], text: 'No te lo piensas dos veces cuando alguien necesita ayuda. A veces te metes en líos por ello, pero nunca te arrepientes.', en: { name: "Brave", text: "You don't think twice when someone needs help. Sometimes it gets you into trouble, but you never regret it." } },
  tranquilo: { name: 'Tranquilo', starters: ['squirtle', 'totodile', 'seel', 'tentacool'], text: 'Cuando todo se desmorona, tú eres quien respira hondo y busca la salida. Los demás se apoyan en ti sin saberlo.', en: { name: "Calm", text: "When everything falls apart, you're the one who takes a deep breath and looks for the way out. Others lean on you without even knowing it." } },
  amable:    { name: 'Amable', starters: ['bulbasaur', 'chikorita', 'oddish', 'sunkern'], text: 'Te fijas en lo que otros pasan por alto: el que se queda atrás, el que no dice nada. Y actúas.', en: { name: "Gentle", text: "You notice what others overlook: the one left behind, the one who says nothing. And you act." } },
  alegre:    { name: 'Alegre', starters: ['pikachu', 'mareep', 'meowth', 'elekid'], text: 'Tu energía contagia. Donde llegas, la gente sonríe, aunque no siempre entiendan por qué.', en: { name: "Jolly", text: "Your energy is contagious. Wherever you go, people smile, even if they don't always know why." } },
  timido:    { name: 'Tímido', starters: ['eevee', 'vulpix', 'smoochum', 'chinchou'], text: 'Prefieres observar antes que hablar. Pero cuando hablas, todo el mundo escucha, porque sabes que vale la pena.', en: { name: "Timid", text: "You'd rather watch than talk. But when you do speak, everyone listens, because they know it's worth it." } },
  osado:     { name: 'Osado', starters: ['ekans', 'spinarak', 'voltorb', 'nidoran_f'], text: 'El riesgo te atrae. No por imprudencia, sino porque sabes que lo bueno está donde nadie se atreve a ir.', en: { name: "Bold", text: "Risk draws you in. Not out of recklessness, but because you know the good stuff is where nobody dares to go." } },
  bromista:  { name: 'Bromista', starters: ['psyduck', 'geodude', 'swinub', 'slugma'], text: 'Ves el lado absurdo de todo. Eso te ha salvado de más de un mal día, a ti y a los que te rodean.', en: { name: "Impish", text: "You see the funny side of everything. It has saved you from more than one bad day, you and those around you." } },
  sereno:    { name: 'Sereno', starters: ['phanpy', 'drowzee', 'ledyba', 'pineco'], text: 'Nada te saca de tu centro. Tienes una paciencia que otros confunden con lentitud, hasta que ven los resultados.', en: { name: "Relaxed", text: "Nothing throws you off balance. You have a patience others mistake for slowness, until they see the results." } },
};

// naturalezas opuestas: una respuesta que encaja con una aleja de la otra
export const OPPOSITE = { valiente: 'timido', timido: 'valiente', osado: 'tranquilo', tranquilo: 'osado', alegre: 'sereno', sereno: 'alegre', amable: 'bromista', bromista: 'amable' };
export const QUIZ_LENGTH = 12;

// Formato: [pregunta, [[respuesta, {naturaleza: puntos, …}], …]]. Si solo se indica a quién suma,
// se le resta 1 a la opuesta de la primera naturaleza (véase norm()).
const RAW = [
  ["Te despiertas y no recuerdas dónde estás. Lo primero que haces es…", [
    ["Explorar. Ya averiguaré el resto por el camino.", { osado: 2 }],
    ["Quedarme quieto y observar antes de moverme.", { timido: 2 }],
    ["Buscar a alguien a quien preguntar.", { amable: 2, alegre: 1 }],
    ["Respirar hondo. Sea lo que sea, ya se resolverá.", { sereno: 2 }]]],
  ["Un amigo te cuenta un plan claramente terrible. ¿Qué le dices?", [
    ["Que cuente conmigo.", { valiente: 2, osado: 1 }],
    ["Le hago una broma para que vea lo absurdo que es.", { bromista: 2 }],
    ["Le explico con calma por qué no va a salir bien.", { tranquilo: 2 }],
    ["Nada. Le acompaño y le cubro las espaldas.", { amable: 2 }]]],
  ["Estás en una fiesta donde no conoces a nadie.", [
    ["En diez minutos conozco a media sala.", { alegre: 2 }],
    ["Busco a la persona que también está sola y hablo con ella.", { amable: 2, timido: 1 }],
    ["Me quedo cerca de la comida hasta que pase algo interesante.", { bromista: 2, sereno: 1 }],
    ["Me voy. No era mi sitio.", { timido: 2 }]]],
  ["Ves un objeto brillante en el fondo de una cueva oscura.", [
    ["Voy a por él ahora mismo.", { osado: 2, valiente: 1 }],
    ["Vuelvo con una luz y un plan.", { tranquilo: 2, sereno: 1 }],
    ["Seguro que es una trampa. Lo dejo.", { timido: 2 }],
    ["Le digo a alguien más que lo coja mientras yo miro.", { bromista: 2 }]]],
  ["Alguien se equivoca en público y todos se ríen.", [
    ["Me acerco y le quito hierro al asunto.", { amable: 2 }],
    ["Me río también, pero con él, no de él.", { bromista: 2, alegre: 1 }],
    ["No me río. No le veo la gracia.", { sereno: 2, valiente: 1 }],
    ["Me da vergüenza ajena y miro hacia otro lado.", { timido: 2 }]]],
  ["Tienes un día entero libre y sin obligaciones.", [
    ["Me voy a algún sitio al que nunca he ido.", { osado: 2 }],
    ["Quedo con gente. Cuanta más, mejor.", { alegre: 2 }],
    ["Un libro, una manta y silencio.", { timido: 2, sereno: 1 }],
    ["Ordeno lo que llevo semanas dejando.", { tranquilo: 2 }]]],
  ["Te han dado un mapa con una X. El camino corto pasa por un bosque con mala fama.", [
    ["Camino corto. Obviamente.", { valiente: 2, osado: 1 }],
    ["Camino largo. Llegaré igual y de una pieza.", { tranquilo: 2 }],
    ["Pregunto por el bosque antes de decidir.", { sereno: 2, timido: 1 }],
    ["Depende de quién venga conmigo.", { amable: 2 }]]],
  ["Cuando algo te sale mal…", [
    ["Me enfado un rato y luego lo vuelvo a intentar.", { valiente: 2 }],
    ["Me río de mí mismo. No queda otra.", { bromista: 2 }],
    ["Analizo qué ha fallado, sin drama.", { tranquilo: 2, sereno: 1 }],
    ["Me lo guardo. Ya lo digeriré.", { timido: 2 }]]],
  ["¿Qué te da más miedo?", [
    ["Aburrirme.", { osado: 2, alegre: 1 }],
    ["Decepcionar a alguien.", { amable: 2 }],
    ["Perder el control de una situación.", { tranquilo: 2 }],
    ["Que me pongan en el centro de atención.", { timido: 2 }]]],
  ["Alguien te reta a una carrera.", [
    ["Ya estoy corriendo antes de que acabe la frase.", { valiente: 2, alegre: 1 }],
    ["Acepto, pero pongo las reglas yo.", { tranquilo: 2 }],
    ["Le dejo ganar y luego le pico con eso durante semanas.", { bromista: 2 }],
    ["No hace falta correr para saber quién es más rápido.", { sereno: 2 }]]],
  ["Te regalan algo que no te gusta nada.", [
    ["Se lo agradezco de corazón. Lo importante es el gesto.", { amable: 2, sereno: 1 }],
    ["Me invento una historia sobre lo mucho que lo necesitaba.", { bromista: 2 }],
    ["Se me nota en la cara antes de poder decir nada.", { alegre: 2, osado: 1 }],
    ["Sonrío y lo guardo en un cajón para siempre.", { timido: 2 }]]],
  ["Si tuvieras que describirte con una sola palabra…", [
    ["Decidido.", { valiente: 2 }],
    ["Curioso.", { osado: 2 }],
    ["Paciente.", { sereno: 2, tranquilo: 1 }],
    ["Cercano.", { amable: 2, alegre: 1 }]]],
  // --- nuevas ---
  ['Encuentras una cartera en el suelo, llena de dinero.', [
    ['La llevo a donde sea para que la recupere su dueño.', { amable: 2, sereno: 1 }],
    ['Busco al dueño yo mismo, aunque me lleve todo el día.', { valiente: 2, amable: 1 }],
    ['Miro dentro por si hay una pista graciosa de quién es.', { bromista: 2, osado: 1 }],
    ['La dejo donde estaba. No quiero líos.', { timido: 2, tranquilo: 1 }]]],
  ['Te retan a cruzar un puente colgante que cruje.', [
    ['Cruzo corriendo, ¡que se vea quién manda!', { osado: 2, valiente: 1 }],
    ['Cruzo despacio, comprobando cada tabla.', { tranquilo: 2, sereno: 1 }],
    ['Cruzo haciendo el payaso para quitarle tensión.', { bromista: 2, alegre: 1 }],
    ['Busco otro camino. No tengo nada que demostrar.', { timido: 2, sereno: 1, osado: -2 }]]],
  ['¿Qué te gusta más de un viaje?', [
    ['Lo que no estaba en el plan.', { osado: 2, alegre: 1 }],
    ['La gente que conoces por el camino.', { amable: 2, alegre: 1 }],
    ['El silencio de los paisajes.', { sereno: 2, timido: 1 }],
    ['Volver a casa y contarlo todo.', { alegre: 2, bromista: 1 }]]],
  ['Alguien a quien aprecias está triste y no quiere hablar.', [
    ['Me siento a su lado sin decir nada.', { sereno: 2, amable: 1 }],
    ['Intento hacerle reír aunque sea un poco.', { bromista: 2, alegre: 1 }],
    ['Le pregunto con cuidado qué ha pasado.', { amable: 2, tranquilo: 1 }],
    ['Le dejo espacio. Ya vendrá cuando quiera.', { timido: 2, tranquilo: 1 }]]],
  ['Estás perdido en un bosque al anochecer.', [
    ['Sigo adelante. Algún camino saldrá.', { osado: 2, valiente: 1 }],
    ['Me paro, pienso y busco señales para orientarme.', { tranquilo: 2, sereno: 1 }],
    ['Canto algo para no tener miedo.', { alegre: 2, bromista: 1 }],
    ['Busco un refugio y espero a que amanezca.', { timido: 2, sereno: 1 }]]],
  ['En un grupo, tú sueles ser…', [
    ['El que propone las ideas locas.', { osado: 2, bromista: 1 }],
    ['El que pone paz cuando hay discusiones.', { tranquilo: 2, amable: 1 }],
    ['El que anima al resto.', { alegre: 2, valiente: 1 }],
    ['El que escucha y observa.', { timido: 2, sereno: 1 }]]],
  ['Te dan a elegir un poder mágico.', [
    ['Volar, para ir a donde nadie ha llegado.', { osado: 2, alegre: 1 }],
    ['Curar a los demás.', { amable: 2, sereno: 1 }],
    ['Hacerme invisible.', { timido: 2, bromista: 1 }],
    ['Una fuerza enorme para proteger a los míos.', { valiente: 2, tranquilo: 1 }]]],
  ['Un compañero se lleva el mérito de algo que hiciste tú.', [
    ['Se lo digo a la cara, con calma pero claro.', { valiente: 2, tranquilo: 1 }],
    ['Me lo tomo con humor. Ya lo sabrá quien tenga que saberlo.', { bromista: 2, sereno: 1 }],
    ['No digo nada, aunque me duela.', { timido: 2, amable: 1 }],
    ['No me importa demasiado mientras salga bien.', { sereno: 2, amable: 1 }]]],
  ['Ante un problema difícil, lo primero que haces es…', [
    ['Lanzarme a probar cosas.', { osado: 2, valiente: 1 }],
    ['Hacer una lista y planearlo.', { tranquilo: 2, timido: 1 }],
    ['Pedir ayuda y resolverlo en equipo.', { amable: 2, alegre: 1 }],
    ['Dejarlo reposar y volver con la cabeza fría.', { sereno: 2, tranquilo: 1 }]]],
  ['¿Qué momento del día prefieres?', [
    ['El amanecer, cuando todo empieza.', { valiente: 2, alegre: 1 }],
    ['El mediodía, con todo el mundo en marcha.', { alegre: 2, osado: 1 }],
    ['El atardecer, tranquilo y dorado.', { sereno: 2, amable: 1 }],
    ['La noche, cuando todo calla.', { timido: 2, tranquilo: 1 }]]],
  ['Alguien te pide un favor justo cuando ibas a descansar.', [
    ['Lo ayudo, claro. Ya descansaré luego.', { amable: 2, valiente: 1 }],
    ['Lo ayudo, pero le hago prometer que me invita a algo.', { bromista: 2, alegre: 1 }],
    ['Le explico que ahora no puedo y quedamos para después.', { tranquilo: 2, sereno: 1 }],
    ['Me cuesta decir que no, así que acabo aceptando.', { timido: 2, amable: 1 }]]],
  ['En un juego de mesa, tú…', [
    ['Arriesgo todo para ganar a lo grande.', { osado: 2, valiente: 1 }],
    ['Calculo cada jugada.', { tranquilo: 2, sereno: 1 }],
    ['Me lo paso bien aunque pierda.', { alegre: 2, bromista: 1 }],
    ['Hago trampas pequeñitas para ver si alguien se da cuenta.', { bromista: 2, osado: 1, amable: -2 }]]],
  ['Oyes un ruido extraño en mitad de la noche.', [
    ['Voy a ver qué es.', { valiente: 2, osado: 1 }],
    ['Me tapo con la manta y espero que pare.', { timido: 2, bromista: 1 }],
    ['Escucho con atención para averiguar qué es sin moverme.', { tranquilo: 2, sereno: 1 }],
    ['Despierto a todo el mundo, por si acaso.', { alegre: 2, amable: 1 }]]],
  ['¿Qué te hace sentir más orgulloso?', [
    ['Haber ayudado a alguien que lo necesitaba.', { amable: 2, valiente: 1 }],
    ['Haberme atrevido a algo que me daba miedo.', { valiente: 2, osado: 1 }],
    ['Haber mantenido la calma cuando otros no podían.', { tranquilo: 2, sereno: 1 }],
    ['Haber hecho reír a alguien en un mal día.', { bromista: 2, alegre: 1 }]]],
  ['Llega un día de lluvia y todos los planes se cancelan.', [
    ['Salgo igualmente. ¡La lluvia también es aventura!', { osado: 2, alegre: 1 }],
    ['Perfecto: libro, manta y ventana.', { sereno: 2, timido: 1 }],
    ['Invito a gente a casa y montamos algo.', { alegre: 2, amable: 1 }],
    ['Aprovecho para ordenar y preparar lo de mañana.', { tranquilo: 2, sereno: 1 }]]],
  ['Un desconocido te pide ayuda con una historia rara.', [
    ['Le ayudo sin pensarlo.', { amable: 2, valiente: 1 }],
    ['Le ayudo, pero con los ojos bien abiertos.', { tranquilo: 2, valiente: 1 }],
    ['Me pica la curiosidad. ¡Cuéntame más!', { osado: 2, bromista: 1 }],
    ['Me excuso educadamente y me voy.', { timido: 2, sereno: 1 }]]],
  ['¿Cómo te describirían tus amigos?', [
    ['Como el que siempre está ahí.', { amable: 2, sereno: 1 }],
    ['Como el alma de la fiesta.', { alegre: 2, bromista: 1 }],
    ['Como el que no se asusta de nada.', { valiente: 2, osado: 1 }],
    ['Como el misterioso del grupo.', { timido: 2, sereno: 1 }]]],
  ['Tienes que dar un discurso delante de mucha gente.', [
    ['Me encanta. Improviso sobre la marcha.', { alegre: 2, osado: 1 }],
    ['Lo preparo a fondo y lo ensayo mil veces.', { tranquilo: 2, timido: 1 }],
    ['Empiezo con un chiste para romper el hielo.', { bromista: 2, alegre: 1 }],
    ['Lo paso fatal, pero lo hago igualmente.', { valiente: 2, timido: 1 }]]],
  ['Ves a alguien mayor cargando bolsas muy pesadas.', [
    ['Me ofrezco a llevárselas.', { amable: 2, valiente: 1 }],
    ['Le ayudo y de paso le saco conversación.', { alegre: 2, amable: 1 }],
    ['Quiero ayudar, pero me da corte ofrecerme.', { timido: 2, amable: 1 }],
    ['Le digo por dónde hay un atajo con menos cuestas.', { tranquilo: 2, bromista: 1 }]]],
  ['Encuentras un mapa antiguo con una X marcada.', [
    ['Salgo a buscar el tesoro hoy mismo.', { osado: 2, valiente: 1 }],
    ['Lo estudio con calma antes de hacer nada.', { tranquilo: 2, sereno: 1 }],
    ['Reúno a mis amigos para ir juntos.', { alegre: 2, amable: 1 }],
    ['Lo guardo. Algún día…', { sereno: 2, timido: 1 }]]],
  ['Algo te sale mal por primera vez.', [
    ['Lo vuelvo a intentar enseguida.', { valiente: 2, osado: 1 }],
    ['Analizo qué ha fallado.', { tranquilo: 2, sereno: 1 }],
    ['Me río de mí mismo y sigo.', { bromista: 2, alegre: 1 }],
    ['Me desanimo un poco, la verdad.', { timido: 2, amable: 1, valiente: -2 }]]],
  ['¿Qué prefieres encontrar al final de un camino?', [
    ['Una cima con vistas increíbles.', { valiente: 2, sereno: 1 }],
    ['Un pueblo lleno de gente simpática.', { alegre: 2, amable: 1 }],
    ['Una cueva inexplorada.', { osado: 2, timido: 1 }],
    ['Un lago en calma.', { sereno: 2, tranquilo: 1 }]]],
  ['Tu equipo pierde y todos están desanimados.', [
    ['Les digo que la próxima la ganamos, ¡y me lo creo!', { alegre: 2, valiente: 1 }],
    ['Repasamos juntos qué podemos mejorar.', { tranquilo: 2, amable: 1 }],
    ['Hago una tontería para que se rían.', { bromista: 2, alegre: 1 }],
    ['Me quedo con quien lo esté pasando peor.', { amable: 2, sereno: 1 }]]],
  ['Si pudieras vivir en cualquier lugar, sería…', [
    ['En lo alto de una montaña.', { sereno: 2, valiente: 1 }],
    ['En un pueblo pequeño junto al mar.', { amable: 2, tranquilo: 1 }],
    ['En una gran ciudad llena de vida.', { alegre: 2, osado: 1 }],
    ['En una cabaña escondida en el bosque.', { timido: 2, sereno: 1 }]]],
];
// El mismo test en inglés, en el mismo orden que RAW: [pregunta, [respuesta, …]] (los puntos son los de RAW)
const RAW_EN = [
  ["You wake up and can't remember where you are. The first thing you do is…", [
    "Explore. I'll figure out the rest along the way.",
    "Stay still and watch before I make a move.",
    "Look for someone to ask.",
    "Take a deep breath. Whatever it is, it'll sort itself out."]],
  ["A friend tells you about a plan that's clearly terrible. What do you say?", [
    "Count me in.",
    "I crack a joke so they see how ridiculous it is.",
    "I calmly explain why it won't work.",
    "Nothing. I go along and watch their back."]],
  ["You're at a party where you don't know anyone.", [
    "Ten minutes in, I've met half the room.",
    "I find the other person standing alone and talk to them.",
    "I stay near the food until something interesting happens.",
    "I leave. It wasn't my scene."]],
  ["You spot something shiny at the back of a dark cave.", [
    "I go and get it right now.",
    "I come back with a light and a plan.",
    "It's a trap, surely. I leave it.",
    "I tell someone else to grab it while I watch."]],
  ["Someone makes a mistake in public and everyone laughs.", [
    "I go over and make light of it.",
    "I laugh too, but with them, not at them.",
    "I don't laugh. I don't see what's funny.",
    "I cringe for them and look away."]],
  ["You have a whole day off with nothing to do.", [
    "I head somewhere I've never been.",
    "I meet up with people. The more, the better.",
    "A book, a blanket and silence.",
    "I sort out what I've been putting off for weeks."]],
  ["You've been given a map with an X. The short way goes through a forest with a bad reputation.", [
    "The short way. Obviously.",
    "The long way. I'll get there all the same, in one piece.",
    "I ask about the forest before deciding.",
    "Depends on who's coming with me."]],
  ["When something goes wrong for you…", [
    "I get angry for a while, then try again.",
    "I laugh at myself. What else can I do?",
    "I work out what went wrong, no drama.",
    "I keep it to myself. I'll deal with it later."]],
  ["What scares you most?", [
    "Being bored.",
    "Letting someone down.",
    "Losing control of a situation.",
    "Being the centre of attention."]],
  ["Someone challenges you to a race.", [
    "I'm already running before they finish the sentence.",
    "I accept, but I set the rules.",
    "I let them win, then tease them about it for weeks.",
    "There's no need to race to know who's faster."]],
  ["Someone gives you a present you don't like at all.", [
    "I thank them from the heart. It's the thought that counts.",
    "I make up a story about how much I needed it.",
    "It shows on my face before I can say a word.",
    "I smile and put it in a drawer forever."]],
  ["If you had to describe yourself in a single word…", [
    "Determined.",
    "Curious.",
    "Patient.",
    "Warm."]],
  ["You find a wallet on the ground, stuffed with money.", [
    "I hand it in somewhere so its owner can get it back.",
    "I look for the owner myself, even if it takes all day.",
    "I peek inside for a funny clue about whose it is.",
    "I leave it where it was. I don't want any trouble."]],
  ["You're dared to cross a creaky rope bridge.", [
    "I run across. Let's see who's boss!",
    "I cross slowly, testing every plank.",
    "I clown around on the way to ease the tension.",
    "I find another way. I've nothing to prove."]],
  ["What do you like most about a journey?", [
    "Whatever wasn't in the plan.",
    "The people you meet along the way.",
    "The silence of the landscapes.",
    "Coming home and telling everyone about it."]],
  ["Someone you care about is sad and doesn't want to talk.", [
    "I sit beside them without saying a word.",
    "I try to make them laugh, even just a little.",
    "I gently ask what happened.",
    "I give them space. They'll come to me when they're ready."]],
  ["You're lost in a forest as night falls.", [
    "I keep going. Some path will turn up.",
    "I stop, think and look for signs to find my way.",
    "I sing something so I won't be scared.",
    "I find shelter and wait for dawn."]],
  ["In a group, you're usually…", [
    "The one with the wild ideas.",
    "The one who keeps the peace when there are arguments.",
    "The one who cheers everyone on.",
    "The one who listens and watches."]],
  ["You get to choose a magic power.", [
    "Flight, to go where nobody has been.",
    "Healing others.",
    "Turning invisible.",
    "Huge strength to protect my own."]],
  ["A teammate takes the credit for something you did.", [
    "I tell them to their face, calmly but clearly.",
    "I take it with humour. Whoever needs to know will know.",
    "I say nothing, even though it hurts.",
    "I don't mind much, as long as it works out."]],
  ["Faced with a tough problem, the first thing you do is…", [
    "Dive in and try things.",
    "Make a list and plan it out.",
    "Ask for help and solve it as a team.",
    "Let it rest and come back with a clear head."]],
  ["Which time of day do you like best?", [
    "Dawn, when everything begins.",
    "Midday, with everyone up and about.",
    "Dusk, calm and golden.",
    "Night, when everything goes quiet."]],
  ["Someone asks you a favour just as you were about to rest.", [
    "I help, of course. I'll rest later.",
    "I help, but make them promise to treat me to something.",
    "I explain I can't right now and we agree on later.",
    "I find it hard to say no, so I end up agreeing."]],
  ["In a board game, you…", [
    "Risk it all to win big.",
    "Calculate every move.",
    "Have fun even if I lose.",
    "Cheat a tiny bit to see if anyone notices."]],
  ["You hear a strange noise in the middle of the night.", [
    "I go and see what it is.",
    "I pull the blanket over my head and hope it stops.",
    "I listen closely to work out what it is without moving.",
    "I wake everyone up, just in case."]],
  ["What makes you feel proudest?", [
    "Having helped someone who needed it.",
    "Having dared to do something that scared me.",
    "Having kept calm when others couldn't.",
    "Having made someone laugh on a bad day."]],
  ["A rainy day comes and all the plans are called off.", [
    "I go out anyway. Rain is an adventure too!",
    "Perfect: a book, a blanket and a window.",
    "I invite people over and we put something together.",
    "I use it to tidy up and get ready for tomorrow."]],
  ["A stranger asks for your help with an odd story.", [
    "I help without a second thought.",
    "I help, but with my eyes wide open.",
    "My curiosity's piqued. Tell me more!",
    "I politely excuse myself and leave."]],
  ["How would your friends describe you?", [
    "As the one who's always there.",
    "As the life and soul of the party.",
    "As the one who's afraid of nothing.",
    "As the mysterious one of the group."]],
  ["You have to give a speech in front of a lot of people.", [
    "I love it. I make it up as I go.",
    "I prepare it thoroughly and rehearse it a thousand times.",
    "I start with a joke to break the ice.",
    "I have an awful time, but I do it anyway."]],
  ["You see an elderly person carrying very heavy bags.", [
    "I offer to carry them.",
    "I help and strike up a conversation while I'm at it.",
    "I want to help, but I'm too shy to offer.",
    "I tell them about a shortcut with fewer hills."]],
  ["You find an old map with an X on it.", [
    "I set off to find the treasure this very day.",
    "I study it calmly before doing anything.",
    "I round up my friends so we can go together.",
    "I put it away. Someday…"]],
  ["Something goes wrong for you for the first time.", [
    "I try again straight away.",
    "I work out what went wrong.",
    "I laugh at myself and carry on.",
    "I get a bit discouraged, to be honest."]],
  ["What would you rather find at the end of a path?", [
    "A summit with incredible views.",
    "A village full of friendly folk.",
    "An unexplored cave.",
    "A still lake."]],
  ["Your team loses and everyone's feeling down.", [
    "I tell them we'll win the next one, and I believe it!",
    "We go over together what we can do better.",
    "I do something silly to make them laugh.",
    "I stay with whoever's taking it hardest."]],
  ["If you could live anywhere, it would be…", [
    "High up on a mountain.",
    "In a little village by the sea.",
    "In a big city full of life.",
    "In a cabin hidden in the forest."]],
];
// cada respuesta resta 1 a la naturaleza opuesta de la primera (salvo que ya se indique otra resta)
const norm = pts => { const out = { ...pts }, first = Object.keys(pts)[0]; if (!Object.values(pts).some(v => v < 0) && !(OPPOSITE[first] in out)) out[OPPOSITE[first]] = -1; return out; };
export const QUESTIONS = RAW.map(([q, a], id) => ({ id, q, a: a.map(([t, pts], k) => ({ t, pts: norm(pts), en: RAW_EN[id][1][k] })), en: RAW_EN[id][0] }));
// el texto de una pregunta (k = undefined) o de una de sus respuestas, en el idioma pedido
export const quizText = (id, k, lang) => { const q = QUESTIONS[id], x = k == null ? q : q?.a[k]; return x && (lang === 'en' ? x.en : (k == null ? x.q : x.t)); };

// Preguntas de esta partida: QUIZ_LENGTH al azar, en orden aleatorio (con las respuestas también barajadas)
export function drawQuiz(rand = Math.random) {
  const ids = QUESTIONS.map(q => q.id);
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  return ids.slice(0, QUIZ_LENGTH).map(id => {
    const q = QUESTIONS[id], order = q.a.map((_, k) => k);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    return { id, q: q.q, a: order.map(k => ({ k, t: q.a[k].t })) };   // k = índice real de la respuesta
  });
}
// ¿Son válidas unas respuestas? [{ id, a }] con QUIZ_LENGTH preguntas distintas y respuestas existentes
export function validAnswers(answers) {
  if (!Array.isArray(answers) || answers.length !== QUIZ_LENGTH) return false;
  const seen = new Set();
  for (const x of answers) {
    const q = QUESTIONS[x?.id];
    if (!q || seen.has(x.id) || !Number.isInteger(x.a) || !q.a[x.a]) return false;
    seen.add(x.id);
  }
  return true;
}
// Puntuación justa: para cada naturaleza se comparan tus puntos con los que sacaría alguien que respondiera al azar
// esas mismas preguntas (media y dispersión de cada pregunta). Así no gana la naturaleza que más respuestas tiene,
// sino aquella con la que más te has alejado de lo esperado.
const STATS = QUESTIONS.map(qq => Object.fromEntries(Object.keys(NATURES).map(n => {
  const vals = qq.a.map(a => a.pts[n] || 0), m = vals.reduce((s, v) => s + v, 0) / vals.length;
  return [n, { m, v: vals.reduce((s, v) => s + (v - m) ** 2, 0) / vals.length }];
})));
export function scoreQuiz(answers) {
  const raw = Object.fromEntries(Object.keys(NATURES).map(k => [k, 0])), mean = { ...raw }, vari = { ...raw };
  for (const x of answers || []) {
    const qq = QUESTIONS[x?.id], a = qq?.a[x.a]; if (!a) continue;
    for (const n of Object.keys(raw)) { raw[n] += a.pts[n] || 0; mean[n] += STATS[x.id][n].m; vari[n] += STATS[x.id][n].v; }
  }
  const pts = Object.fromEntries(Object.keys(raw).map(n => [n, (raw[n] - mean[n]) / Math.sqrt(vari[n] + 0.25)]));
  // empate: se decide de forma estable según las respuestas (vista previa y registro coinciden)
  const seed = (answers || []).reduce((h, x) => (h * 31 + (x.id | 0) * 7 + (x.a | 0)) >>> 0, 17);
  const keys = Object.keys(pts).sort((a, b) => pts[b] - pts[a] || ((seed >> (a.length % 7)) & 1 ? 1 : -1));
  const best = keys[0], list = NATURES[best].starters, starter = list[seed % list.length];
  const { starters, ...nat } = NATURES[best];
  return { nature: best, ...nat, starter, points: pts };
}
export const publicQuiz = () => drawQuiz();
