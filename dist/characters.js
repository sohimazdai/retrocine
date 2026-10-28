import * as T from "three";

export const CHARACTER_CATEGORIES = [
  ["all", "Все"],
  ["heroes", "Герои"],
  ["stars", "Звёзды"],
  ["jobs", "Профессии"],
  ["creatures", "Существа"],
  ["fantasy", "Фэнтези"],
  ["basic", "Базовые"],
];
const defaults = {
  hairstyle: "bald",
  headwear: "signature",
  outfit: "signature",
  footwear: "signature",
  skin: "#e4b59b",
  hairColor: "#493339",
  pantsColor: "#454050",
  shoeColor: "#36323d",
  glasses: false,
  mask: "none",
};
export const CHARACTERS = [
  {
    id: "labubu",
    name: "Лабубу",
    subtitle: "The Monsters",
    category: "creatures",
    color: "#baa080",
    skin: "#edd3b4",
    pantsColor: "#baa080",
  },
  {
    id: "batman",
    name: "Batman",
    subtitle: "Тёмный рыцарь",
    category: "heroes",
    color: "#565968",
    pantsColor: "#454957",
    shoeColor: "#252633",
  },
  {
    id: "lego-boy",
    name: "LEGO boy",
    subtitle: "Жёлтая минифигурка",
    category: "heroes",
    color: "#d84b45",
    skin: "#f4cb3c",
    pantsColor: "#3973bb",
    shoeColor: "#3973bb",
  },
  {
    id: "builder",
    name: "Строитель",
    subtitle: "Каска и рабочий жилет",
    category: "jobs",
    color: "#ee9250",
    pantsColor: "#4e7494",
    shoeColor: "#76543b",
    hairstyle: "short",
  },
  {
    id: "miner",
    name: "Шахтёр",
    subtitle: "Налобный фонарь",
    category: "jobs",
    color: "#536a80",
    pantsColor: "#465767",
    shoeColor: "#3e3835",
    hairstyle: "short",
  },
  {
    id: "doctor",
    name: "Врач",
    subtitle: "Халат и стетоскоп",
    category: "jobs",
    color: "#eeeef0",
    pantsColor: "#63a6a1",
    shoeColor: "#e6e9e9",
    hairstyle: "bun",
  },
  {
    id: "soldier",
    name: "Солдат",
    subtitle: "Шлем и походное снаряжение",
    category: "jobs",
    color: "#6c7952",
    pantsColor: "#626f4b",
    shoeColor: "#3b3e31",
  },
  {
    id: "robot",
    name: "Робот",
    subtitle: "Светящийся визор",
    category: "creatures",
    color: "#97aebb",
    skin: "#97aebb",
    pantsColor: "#798c9d",
    shoeColor: "#697c90",
  },
  {
    id: "penguin",
    name: "Пингвин",
    subtitle: "Ласты и оранжевый клюв",
    category: "creatures",
    color: "#333747",
    skin: "#333747",
    pantsColor: "#333747",
    shoeColor: "#edac51",
  },
  {
    id: "wolf",
    name: "Волк",
    subtitle: "Ушки, морда и хвост",
    category: "creatures",
    color: "#8b98a7",
    skin: "#8b98a7",
    pantsColor: "#8b98a7",
    shoeColor: "#667485",
  },
  {
    id: "lion",
    name: "Лев",
    subtitle: "Объёмная грива",
    category: "creatures",
    color: "#d7a04f",
    skin: "#d7a04f",
    pantsColor: "#d7a04f",
    shoeColor: "#c18c42",
  },
  {
    id: "flame-princess",
    name: "Принцесса огня",
    subtitle: "Живые волосы-пламя",
    category: "fantasy",
    color: "#ef6b35",
    skin: "#f4aa52",
    pantsColor: "#f4aa52",
    hairstyle: "flame",
    hairColor: "#ff762e",
    shoeColor: "#f4aa52",
  },
  {
    id: "ice-king",
    name: "Ледяной король",
    subtitle: "Корона и белая борода",
    category: "fantasy",
    color: "#487dd1",
    skin: "#99cee7",
    pantsColor: "#6fb5d7",
    shoeColor: "#434373",
  },
  {
    id: "astronaut",
    name: "Астронавт",
    subtitle: "Шлем и кислородный ранец",
    category: "jobs",
    color: "#e6e9ef",
    skin: "#bd8f70",
    pantsColor: "#d2d8e3",
    shoeColor: "#a6afc0",
    outfit: "spacesuit",
    footwear: "space",
  },
  {
    id: "samurai",
    name: "Самурай",
    subtitle: "Кабуто и пластинчатая броня",
    category: "fantasy",
    color: "#9b444b",
    pantsColor: "#3f3346",
    shoeColor: "#3f3346",
    hairstyle: "bun",
  },
  {
    id: "pirate",
    name: "Пират",
    subtitle: "Треуголка и повязка",
    category: "fantasy",
    color: "#526883",
    pantsColor: "#55463f",
    shoeColor: "#49382e",
    hairstyle: "long",
  },
  {
    id: "forest-spirit",
    name: "Лесной дух",
    subtitle: "Кора, листья и светлячки",
    category: "fantasy",
    color: "#719b68",
    skin: "#b5c79c",
    pantsColor: "#826a50",
    shoeColor: "#826a50",
  },
  {
    id: "spiderman",
    name: "Человек-паук",
    subtitle: "Красно-синий костюм и паутина",
    category: "heroes",
    color: "#c5262c",
    pantsColor: "#2a4b9b",
    shoeColor: "#1f2f66",
  },
  {
    id: "trump",
    name: "Дональд Трамп",
    subtitle: "Зачёс и длинный красный галстук",
    category: "stars",
    color: "#23304e",
    skin: "#e8b074",
    pantsColor: "#23304e",
    shoeColor: "#23242a",
    hairstyle: "short",
    hairColor: "#e8d08a",
  },
  {
    id: "messi",
    name: "Месси",
    subtitle: "Сборная Аргентины, №10",
    category: "stars",
    color: "#8cc6e6",
    skin: "#d9a173",
    pantsColor: "#2a2d36",
    shoeColor: "#d64f7a",
    hairstyle: "short",
    hairColor: "#2d2420",
  },
  {
    id: "dualipa",
    name: "Дуа Липа",
    subtitle: "Длинные тёмные волосы, поп-образ",
    category: "stars",
    color: "#c6335f",
    skin: "#e2ab83",
    pantsColor: "#20222b",
    shoeColor: "#20222b",
    hairstyle: "long",
    hairColor: "#171318",
  },
  {
    id: "jon-snow",
    name: "Джон Сноу",
    subtitle: "Чёрный меховой плащ Дозора",
    category: "fantasy",
    color: "#2f2d31",
    skin: "#d7a981",
    pantsColor: "#2a2622",
    shoeColor: "#211d1a",
    hairstyle: "curly",
    hairColor: "#241c1d",
  },
  {
    id: "six", name: "Шесть", subtitle: "Six · Little Nightmares",
    category: "heroes", color: "#dbbd32", skin: "#d3bc91",
    pantsColor: "#d3bc91", shoeColor: "#d3bc91",
  },
  {
    id: "little-sister", name: "Сестричка", subtitle: "Little Sister · BioShock",
    category: "heroes", color: "#788b9e", skin: "#d1c6ae",
    pantsColor: "#d1c6ae", shoeColor: "#493b32", hairColor: "#342b26",
  },
  {
    id: "ciri", name: "Цири", subtitle: "Ciri · The Witcher",
    category: "fantasy", color: "#ece4d0", skin: "#e5c4ac",
    pantsColor: "#695246", shoeColor: "#463b33", hairColor: "#dedbd2",
  },
  {
    id: "anton-chigurh", name: "Антон Чигур", subtitle: "Старикам тут не место · Anton Chigurh",
    category: "stars", color: "#514737", skin: "#cfab8c",
    pantsColor: "#393e40", shoeColor: "#3b2d26", hairColor: "#302820",
  },
  {
    id: "elastigirl", name: "Эластика", subtitle: "Elastigirl · Суперсемейка",
    category: "heroes", color: "#c93830", skin: "#e7b89a",
    pantsColor: "#c93830", shoeColor: "#25232a", hairColor: "#813e29",
  },
  {
    id: "scarlet-witch", name: "Алая ведьма", subtitle: "Scarlet Witch · Marvel",
    category: "heroes", color: "#962c42", skin: "#e9c2aa",
    pantsColor: "#382b37", shoeColor: "#3c2430", hairColor: "#9b4f32",
    hairstyle: "long",
  },
  {
    id: "eleven", name: "Одиннадцать", subtitle: "Eleven · Очень странные дела · Stranger Things",
    category: "heroes", color: "#c98e9b", skin: "#e2bba3",
    pantsColor: "#e2bba3", shoeColor: "#eee6db", hairColor: "#66513d",
  },
  {
    id: "alf", name: "Альф", subtitle: "ALF · Гость с Мельмака",
    category: "creatures", color: "#b17b48", skin: "#b17b48",
    pantsColor: "#b17b48", shoeColor: "#895a35", hairColor: "#78492f",
  },
  {
    id: "winnie-pooh", name: "Винни-Пух", subtitle: "Winnie the Pooh · Мишка и мёд",
    category: "creatures", color: "#ad7e44", skin: "#ad7e44",
    pantsColor: "#ad7e44", shoeColor: "#694a2f",
  },
  {
    id: "carlson", name: "Карлсон", subtitle: "Малыш и Карлсон · Пропеллер за спиной",
    category: "fantasy", color: "#83a580", skin: "#edbe9c",
    pantsColor: "#bb754c", shoeColor: "#743c2b", hairColor: "#c35a29",
  },
  {
    id: "spongebob", name: "Спанчбоб", subtitle: "Губка Боб Квадратные Штаны · SpongeBob",
    category: "creatures", color: "#f0ce39", skin: "#f0ce39",
    pantsColor: "#997047", shoeColor: "#25262c",
  },
  {
    id: "cheburashka", name: "Чебурашка", subtitle: "Большие уши и доброе сердце",
    category: "creatures", color: "#744a32", skin: "#b68a5f",
    pantsColor: "#744a32", shoeColor: "#5d3c2a",
  },
].map((p) => ({ ...defaults, ...p, character: p.id }));

// Original procedural toy interpretations. Every accessory is a mesh attached
// to the existing joint hierarchy, so all room actions use the same rig.
export function dressCharacter(rig, p, primitives) {
  const { box, ball, material, cylinder, pivot } = primitives;
  const id = p.character;
  if (!CHARACTERS.some((c) => c.id === id)) return;
  const { head, torso, face, arms, elbows, legs, knees, feet } = rig;
  const baseHeadChildren = new Set(head.children);
  const signatureHead = p.headwear === "signature",
    signatureBody = p.outfit === "signature";
  const signatureFeet = p.footwear === "signature";
  rig.features = {};
  rig.secondary = [];
  const part = (name, parent = head) => {
    const g = new T.Group();
    g.name = `${id}:${name}`;
    parent.add(g);
    rig.features[name] = g;
    return g;
  };
  const mesh = (parent, geometry, color, x = 0, y = 0, z = 0) => {
    const m = new T.Mesh(
      geometry,
      typeof color === "string" ? material(color) : color,
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const cone = (parent, color, r, h, x, y, z, sides = 12) =>
    mesh(parent, new T.ConeGeometry(r, h, sides), color, x, y, z);
  const polygon = (parent, points, color, depth = 0.035, z = 0) => {
    const shape = new T.Shape(points.map(([x, y]) => new T.Vector2(x, y)));
    return mesh(
      parent,
      new T.ExtrudeGeometry(shape, { depth, bevelEnabled: false }),
      color,
      0,
      0,
      z,
    );
  };
  const tube = (parent, points, color, radius = 0.018) =>
    mesh(
      parent,
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
        24,
        radius,
        6,
        false,
      ),
      color,
    );
  const glow = (color) =>
    new T.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.8,
      roughness: 0.35,
    });
  const hideMeshes = (group) =>
    group.children.filter((c) => c.isMesh).forEach((c) => (c.visible = false));
  const garment = (name = "costume") => {
    hideMeshes(torso);
    return part(name, torso);
  };
  const softBody = (color = p.color, belly = null) => {
    const g = garment();
    ball(g, color, 0, -0.035, 0, 0.32, 0.37, 0.26);
    if (belly) ball(g, belly, 0, -0.03, 0.215, 0.235, 0.29, 0.09);
    return g;
  };
  const newFace = (color, width = 0.88, height = 0.78, depth = 0.72) => {
    face.visible = false;
    const g = part("face");
    box(g, width, height, depth, color, 0, 0, 0, 0.17);
    rig.eyes = [];
    rig.brows = [];
    for (const s of [-1, 1]) {
      const eye = pivot(g, s * 0.205, 0.055, depth / 2 + 0.015);
      ball(eye, "#171a25", 0, 0, 0, 0.135, 0.155, 0.065, 0.12);
      ball(eye, "#fff8e9", -0.03, 0.045, 0.06, 0.032, 0.035, 0.012);
      rig.eyes.push(eye);
      rig.brows.push(
        box(
          g,
          0.17,
          0.025,
          0.025,
          color,
          s * 0.21,
          0.25,
          depth / 2 + 0.03,
          0.008,
        ),
      );
    }
    rig.mouth = pivot(g, 0, -0.23, depth / 2 + 0.04);
    ball(rig.mouth, "#613e3c", 0, 0, 0, 0.07, 0.018, 0.018);
    rig.mouthOpen = ball(rig.mouth, "#352537", 0, 0, 0.006, 0.06, 0.05, 0.018);
    rig.mouthOpen.visible = false;
    return g;
  };
  const paws = (color = p.color, webbed = false) => {
    if (!signatureFeet) return;
    feet.forEach((foot) => {
      hideMeshes(foot);
      box(
        foot,
        0.26,
        0.13,
        webbed ? 0.39 : 0.32,
        color,
        0,
        -0.005,
        0.06,
        0.045,
      );
    });
  };
  const cloak = (color, scalloped = false) => {
    const g = part("cape", torso);
    g.position.set(0, 0.19, -0.22);
    const points = scalloped
      ? [
          [-0.22, 0],
          [0.22, 0],
          [0.48, -0.67],
          [0.25, -0.59],
          [0, -0.72],
          [-0.25, -0.59],
          [-0.48, -0.67],
        ]
      : [
          [-0.22, 0],
          [0.22, 0],
          [0.39, -0.6],
          [-0.39, -0.6],
        ];
    polygon(g, points, color, 0.035, -0.035);
    rig.secondary.push({ object: g, type: "cape", base: 0.12 });
    return g;
  };
  const belt = (g, color = "#b49c62") => {
    box(g, 0.47, 0.075, 0.38, color, 0, -0.18, 0.01, 0.015);
    box(g, 0.1, 0.09, 0.035, "#ead596", 0, -0.18, 0.22, 0.012);
  };
  const hardhat = (color, lamp = false) => {
    const g = part("helmet");
    ball(g, color, 0, 0.28, 0, 0.48, 0.32, 0.42);
    box(g, 0.98, 0.08, 0.89, color, 0, 0.19, 0.045, 0.035);
    box(g, 0.07, 0.31, 0.72, color, 0, 0.38, 0, 0.03);
    if (lamp) {
      box(g, 0.92, 0.07, 0.73, "#403d36", 0, 0.25, 0, 0.025);
      const housing = cylinder(g, "#4b493d", 0.13, 0.13, 0.1, 0, 0.28, 0.44);
      housing.rotation.x = Math.PI / 2;
      const lens = cylinder(g, glow("#fff1ad"), 0.1, 0.1, 0.015, 0, 0.28, 0.5);
      lens.rotation.x = Math.PI / 2;
    }
    return g;
  };
  const furryEars = (g, color, insideColor, tall = false) => {
    for (const s of [-1, 1]) {
      const ear = pivot(g, 0, 0, 0);
      polygon(
        ear,
        [
          [s * 0.22, 0.31],
          [s * 0.53, 0.35],
          [s * (tall ? 0.44 : 0.41), tall ? 1.13 : 0.78],
        ],
        color,
        0.18,
        -0.08,
      );
      polygon(
        ear,
        [
          [s * 0.28, 0.4],
          [s * 0.46, 0.42],
          [s * (tall ? 0.42 : 0.4), tall ? 0.99 : 0.67],
        ],
        insideColor,
        0.025,
        0.11,
      );
      if (tall) rig.secondary.push({ object: ear, type: "ear", side: s });
    }
  };
  const tail = (color, tipColor) => {
    const g = part("tail", torso);
    g.position.set(0, -0.24, -0.15);
    const stem = ball(g, color, 0, 0.02, -0.23, 0.105, 0.1, 0.3);
    stem.rotation.x = -0.3;
    ball(g, tipColor, 0, 0.12, -0.48, 0.12, 0.115, 0.16);
    rig.secondary.push({ object: g, type: "tail" });
  };

  if (id === "six") {
    // The iconic oversized yellow raincoat hood: a rounded shell that swallows the head and droops
    // to a long point in front, leaving the little face in shadow underneath.
    if (signatureHead) {
      // The face is lost in the shadow of the hood.
      face.visible = false;
      const g = part("raincoat-hood");
      // A tall pointed hood facing forward, framing a dark opening — Six's signature silhouette.
      const outer = new T.Shape();
      outer.moveTo(0.1, 0.82);
      outer.bezierCurveTo(-0.04, 0.64, -0.42, 0.3, -0.57, -0.04);
      outer.quadraticCurveTo(-0.65, -0.2, -0.43, -0.38);
      outer.quadraticCurveTo(0, -0.52, 0.43, -0.38);
      outer.quadraticCurveTo(0.62, -0.24, 0.5, 0.08);
      outer.quadraticCurveTo(0.37, 0.53, 0.1, 0.82);
      const hole = new T.Path();
      hole.moveTo(-0.37, -0.28);
      hole.quadraticCurveTo(0, -0.43, 0.36, -0.28);
      hole.quadraticCurveTo(0.42, -0.14, 0.29, 0.07);
      hole.quadraticCurveTo(0.16, 0.2, 0.04, 0.26);
      hole.quadraticCurveTo(-0.3, 0.1, -0.37, -0.28);
      outer.holes.push(hole);
      mesh(
        g,
        new T.ExtrudeGeometry(outer, { depth: 0.66, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.035, bevelSegments: 3 }),
        p.color,
        0,
        0.02,
        -0.22,
      );
      // The shadowed inside of the hood and a hint of the little chin.
      box(g, 0.83, 0.73, 0.12, "#241f15", 0, -0.04, 0.05, 0.06);
      ball(g, p.skin, 0, -0.22, 0.23, 0.18, 0.11, 0.09);
      box(g, 0.47, 0.22, 0.1, "#241f15", 0, -0.025, 0.28, 0.06);
      box(g, 0.09, 0.012, 0.015, "#876b4b", 0.02, -0.25, 0.315, 0.004);
      // A rounded shell closing the back and sides.
      box(g, 0.92, 0.9, 0.5, p.color, 0, 0.06, -0.24, 0.22);
    }
    if (signatureBody) {
      const g = garment();
      // A long yellow slicker: wide at the hem, past the hips, with a seam and two pockets.
      const coat = cylinder(g, p.color, 0.22, 0.41, 0.72, 0, -0.14, 0);
      coat.scale.z = 0.74;
      box(g, 0.03, 0.66, 0.025, "#c28f1f", 0, -0.12, 0.3, 0.008);
      for (const y of [0.1, -0.08, -0.26]) {
        box(g, 0.11, 0.045, 0.04, "#e8cb43", 0.035, y, 0.31, 0.012);
        ball(g, "#a78d25", 0.07, y, 0.337, 0.018, 0.018, 0.01);
      }
      for (const s of [-1, 1]) {
        box(g, 0.15, 0.14, 0.04, "#d9b02f", s * 0.17, -0.26, 0.28, 0.03);
        // Sleeve cuffs.
        box(arms[s === -1 ? 0 : 1], 0.2, 0.16, 0.2, p.color, 0, -0.07, 0, 0.05);
      }
    }
    paws(p.skin);
  }
  if (id === "little-sister") {
    const g = part("glowing-eyes", face);
    rig.eyes.forEach((eye) => {
      eye.children[0].material = glow("#f5d965");
      rig.secondary.push({ object: eye.children[0], type: "light" });
    });
    // Keep the eyes on the facial rig so blinking and emotions still work.
    ball(g, "#988774", 0.13, -0.17, 0.35, 0.055, 0.018, 0.012);
    if (signatureHead) {
      const hair = part("sister-hair");
      box(hair, 0.86, 0.24, 0.73, p.hairColor, 0, 0.31, -0.04, 0.1);
      box(hair, 0.8, 0.55, 0.2, p.hairColor, 0, 0.03, -0.32, 0.08);
      for (const s of [-1, 1]) {
        ball(hair, p.hairColor, s * 0.38, 0.28, -0.16, 0.2, 0.22, 0.19);
        box(hair, 0.2, 0.07, 0.1, "#c6b5a1", s * 0.39, 0.29, 0.02, 0.02);
      }
    }
    if (signatureBody) {
      const dress = garment("sister-dress");
      cylinder(dress, p.color, 0.21, 0.36, 0.56, 0, -0.06, 0).scale.z = 0.7;
      box(dress, 0.25, 0.4, 0.04, "#d8cbb4", 0, -0.08, 0.21, 0.03);
      for (const s of [-1, 1]) {
        ball(dress, "#e4d7c3", s * 0.085, 0.17, 0.16, 0.1, 0.055, 0.04);
        ball(arms[s === -1 ? 0 : 1], p.color, 0, -0.04, 0, 0.13, 0.13, 0.13);
      }
      box(dress, 0.5, 0.055, 0.34, "#d8cbb4", 0, -0.3, 0, 0.018);
    }
    paws(p.shoeColor);
  }
  if (id === "ciri") {
    const scar = part("cheek-scar", face);
    tube(scar, [[-0.28, 0.19, 0.36], [-0.25, 0.02, 0.414], [-0.13, -0.18, 0.36]], "#ac746a", 0.012);
    rig.eyes.forEach((eye) => ball(eye, "#739e69", 0, 0, 0.067, 0.055, 0.073, 0.017));
    if (signatureHead) {
      const hair = part("ashen-hair");
      box(hair, 0.86, 0.22, 0.72, p.hairColor, 0, 0.33, -0.03, 0.1);
      ball(hair, p.hairColor, 0, 0.15, -0.39, 0.28, 0.28, 0.15);
      for (const s of [-1, 1]) {
        const lock = box(hair, 0.16, 0.65, 0.16, p.hairColor, s * 0.36, 0.01, 0.25, 0.07);
        lock.rotation.z = -s * 0.2;
      }
      box(hair, 0.4, 0.17, 0.14, p.hairColor, -0.13, 0.25, 0.33, 0.06).rotation.z = -0.3;
    }
    if (signatureBody) {
      const body = garment("witcher-outfit");
      box(body, 0.47, 0.45, 0.34, p.color, 0, -0.02, 0, 0.07);
      polygon(body, [[-0.08, 0.2], [0.08, 0.2], [0, -0.02]], p.skin, 0.02, 0.18);
      belt(body, "#654c37");
      box(body, 0.12, 0.23, 0.08, "#715741", 0.2, -0.2, 0.12, 0.02);
      elbows.forEach((e) => box(e, 0.16, 0.18, 0.18, "#795e43", 0, -0.07, 0, 0.035));
      const sword = part("witcher-sword", torso);
      sword.position.set(-0.12, 0.03, -0.28);
      sword.rotation.z = -0.5;
      box(sword, 0.09, 0.76, 0.07, "#50493f", 0, -0.12, 0, 0.018);
      box(sword, 0.23, 0.04, 0.09, "#bdc3c2", 0, 0.27, 0, 0.012);
      cylinder(sword, "#564031", 0.035, 0.035, 0.2, 0, 0.38, 0);
      ball(sword, "#bdc3c2", 0, 0.49, 0, 0.045);
    }
    paws(p.shoeColor);
  }
  if (id === "anton-chigurh") {
    if (signatureHead) {
      const hair = part("chigurh-bob");
      box(hair, 0.94, 0.3, 0.79, p.hairColor, 0, 0.3, -0.035, 0.13);
      box(hair, 0.88, 0.58, 0.22, p.hairColor, 0, 0, -0.31, 0.07);
      for (const s of [-1, 1])
        box(hair, 0.18, 0.58, 0.55, p.hairColor, s * 0.43, -0.015, -0.035, 0.08);
      box(hair, 0.68, 0.14, 0.1, p.hairColor, 0, 0.28, 0.36, 0.04);
    }
    if (signatureBody) {
      const jacket = garment("chigurh-jacket");
      box(jacket, 0.49, 0.5, 0.36, p.color, 0, -0.055, 0, 0.065);
      box(jacket, 0.13, 0.42, 0.025, "#a59c7f", 0, -0.02, 0.19, 0.01);
      for (const s of [-1, 1]) {
        box(jacket, 0.12, 0.2, 0.04, "#71634b", s * 0.1, 0.11, 0.2, 0.012).rotation.z = s * 0.4;
        box(jacket, 0.13, 0.11, 0.04, "#655842", s * 0.14, -0.15, 0.2, 0.012);
      }
      const coin = part("coin", elbows[1]);
      cylinder(coin, "#c7c1a5", 0.045, 0.045, 0.014, 0, -0.19, 0.065).rotation.x = Math.PI / 2;
    }
    paws(p.shoeColor);
  }
  if (id === "elastigirl") {
    if (signatureHead) {
      const mask = part("hero-mask");
      // Rings leave the animated eyes visible through the black domino mask.
      for (const s of [-1, 1]) {
        mesh(mask, new T.TorusGeometry(0.15, 0.035, 8, 24), "#25232a", s * 0.215, 0.02, 0.37).scale.y = 0.85;
        box(mask, 0.14, 0.5, 0.45, p.hairColor, s * 0.4, 0.01, -0.09, 0.06);
      }
      box(mask, 0.14, 0.055, 0.05, "#25232a", 0, 0.02, 0.39, 0.015);
      box(mask, 0.87, 0.25, 0.74, p.hairColor, 0, 0.33, -0.05, 0.1);
      box(mask, 0.83, 0.55, 0.2, p.hairColor, 0, 0.02, -0.32, 0.08);
      box(mask, 0.54, 0.16, 0.18, p.hairColor, -0.15, 0.27, 0.3, 0.06).rotation.z = -0.22;
    }
    if (signatureBody) {
      const suit = garment("incredibles-suit");
      box(suit, 0.46, 0.46, 0.35, p.color, 0, -0.03, 0, 0.07);
      box(suit, 0.46, 0.12, 0.36, "#25232a", 0, -0.2, 0, 0.04);
      box(suit, 0.47, 0.045, 0.37, "#e59338", 0, -0.14, 0, 0.01);
      ball(suit, "#eebd38", 0, 0.06, 0.19, 0.13, 0.09, 0.02);
      ball(suit, "#25232a", 0, 0.06, 0.207, 0.1, 0.075, 0.012);
      box(suit, 0.035, 0.08, 0.015, "#f8d04f", 0, 0.04, 0.22, 0.008);
      ball(suit, "#f8d04f", 0, 0.11, 0.22, 0.023, 0.023, 0.01);
      elbows.forEach((e) => box(e, 0.17, 0.24, 0.19, "#25232a", 0, -0.09, 0, 0.05));
    }
    paws(p.shoeColor);
  }
  if (id === "scarlet-witch") {
    if (signatureHead) {
      const crown = part("scarlet-crown");
      polygon(crown, [[-0.44, 0.14], [-0.43, 0.59], [-0.21, 0.37], [0, 0.48], [0.21, 0.37], [0.43, 0.59], [0.44, 0.14], [0.22, 0.23], [0, 0.1], [-0.22, 0.23]], p.color, 0.055, 0.365);
      ball(crown, "#d45c67", 0, 0.32, 0.43, 0.045, 0.07, 0.02);
    }
    if (signatureBody) {
      const body = garment("scarlet-costume");
      box(body, 0.44, 0.43, 0.35, p.color, 0, -0.03, 0, 0.06);
      for (const s of [-1, 1]) {
        polygon(body, [[s * 0.06, 0.17], [s * 0.2, 0.17], [s * 0.11, -0.2], [0, -0.13]], "#532434", 0.025, 0.18);
        const magic = part(`chaos-magic-${s}`, elbows[s === -1 ? 0 : 1]);
        const orb = ball(magic, glow("#ed425b"), 0, -0.17, 0.13, 0.085);
        mesh(magic, new T.TorusGeometry(0.12, 0.012, 6, 24), glow("#e86578"), 0, -0.17, 0.13);
        rig.secondary.push({ object: orb, type: "light" });
      }
      cloak(p.color);
    }
    paws(p.shoeColor);
  }
  if (id === "eleven") {
    if (signatureHead) {
      const hair = part("buzz-cut");
      box(hair, 0.83, 0.18, 0.7, p.hairColor, 0, 0.32, -0.025, 0.08);
      box(hair, 0.82, 0.4, 0.12, p.hairColor, 0, 0.08, -0.32, 0.05);
    }
    if (signatureBody) {
      const dress = garment("eleven-dress");
      cylinder(dress, p.color, 0.21, 0.35, 0.54, 0, -0.06, 0).scale.z = 0.75;
      for (const s of [-1, 1]) {
        ball(dress, "#f1e8dc", s * 0.09, 0.17, 0.17, 0.1, 0.05, 0.04);
        box(dress, 0.11, 0.37, 0.35, "#405976", s * 0.2, 0.01, 0, 0.03);
      }
      arms.forEach((a, i) => {
        hideMeshes(a);
        hideMeshes(elbows[i]);
        box(a, 0.18, 0.21, 0.2, "#405976", 0, -0.075, 0, 0.05);
        box(elbows[i], 0.15, 0.14, 0.17, "#405976", 0, -0.04, 0, 0.04);
        rig.hands[i].visible = true;
      });
      const waffle = part("waffle", elbows[1]);
      box(waffle, 0.19, 0.19, 0.045, "#d8a45b", 0, -0.18, 0.09, 0.025);
      for (const v of [-0.05, 0, 0.05]) {
        box(waffle, 0.012, 0.16, 0.012, "#a77239", v, -0.18, 0.118, 0.003);
        box(waffle, 0.16, 0.012, 0.012, "#a77239", 0, -0.18 + v, 0.118, 0.003);
      }
    }
    if (signatureFeet) {
      knees.forEach((k) => {
        box(k, 0.16, 0.13, 0.17, "#f1e8dc", 0, -0.045, 0, 0.035);
        box(k, 0.165, 0.02, 0.175, "#426a87", 0, -0.005, 0, 0.006);
      });
      paws(p.shoeColor);
    }
  }
  if (["alf", "winnie-pooh", "cheburashka"].includes(id)) {
    const g = newFace(p.skin, 0.88, 0.78, 0.74);
    const fur = part("fur-head");
    box(fur, 1, 0.88, 0.72, p.color, 0, 0.015, -0.12, 0.2);
    g.position.z = 0.08;
    const ears = part("round-ears");
    for (const s of [-1, 1]) {
      const big = id === "cheburashka";
      const ear = pivot(ears, s * (big ? 0.67 : 0.43), big ? 0.03 : 0.37, -0.08);
      ball(ear, p.color, 0, 0, 0, big ? 0.34 : 0.18, big ? 0.36 : 0.2, 0.14);
      ball(ear, big ? "#aa7b50" : "#694831", 0, 0, 0.12, big ? 0.25 : 0.1, big ? 0.27 : 0.12, 0.035);
      rig.secondary.push({ object: ear, type: "ear", side: s });
    }
    if (id === "alf") {
      // Long ridged muzzle and the swept tuft distinguish ALF from the bears.
      const snout = part("alf-snout");
      ball(snout, p.color, 0, -0.07, 0.53, 0.22, 0.17, 0.29);
      ball(snout, "#684730", 0, -0.015, 0.78, 0.12, 0.075, 0.055);
      for (const z of [0.49, 0.58, 0.67])
        tube(snout, [[-0.16, 0, z], [0, 0.08, z], [0.16, 0, z]], "#906036", 0.012);
      for (let i = 0; i < 5; i++) {
        const tuft = cone(fur, p.hairColor, 0.085, 0.28, -0.16 + i * 0.08, 0.51, -0.04, 7);
        tuft.rotation.z = -0.35;
      }
      rig.mouth.position.set(0, -0.23, 0.57);
      if (signatureBody) {
        softBody(p.color, "#c08e55");
        tail(p.color, p.color);
      }
    } else if (id === "winnie-pooh") {
      for (let i = 0; i < 2; i++) {
        const s = i ? 1 : -1;
        ball(g, "#64452e", s * 0.205, 0.06, 0.39, 0.185, 0.22, 0.03);
        rig.eyes[i].position.z = 0.43;
        rig.eyes[i].scale.setScalar(0.72);
      }
      ball(g, "#d0a363", 0, -0.16, 0.41, 0.24, 0.15, 0.09);
      ball(g, "#312c25", 0, -0.08, 0.5, 0.11, 0.08, 0.055);
      rig.mouth.position.z = 0.49;
      if (signatureBody) {
        softBody(p.color, "#c79a59");
        const honey = part("honey-pot", elbows[0]);
        cylinder(honey, "#8e5a32", 0.1, 0.08, 0.16, 0, -0.2, 0.1);
        cylinder(honey, "#e6b54b", 0.1, 0.1, 0.035, 0, -0.115, 0.1);
      }
    } else {
      ball(g, "#443025", 0, -0.09, 0.415, 0.075, 0.05, 0.045);
      if (signatureBody) softBody(p.color, "#ad8054");
    }
    paws(p.shoeColor);
  }
  if (id === "carlson") {
    if (signatureHead) {
      const hair = part("ginger-hair");
      box(hair, 0.83, 0.2, 0.68, p.hairColor, 0, 0.31, -0.05, 0.09);
      box(hair, 0.8, 0.33, 0.16, p.hairColor, 0, 0.14, -0.32, 0.07);
      for (let i = 0; i < 5; i++)
        ball(hair, p.hairColor, -0.27 + i * 0.12, 0.35 + Math.sin(i) * 0.06, 0.25, 0.12, 0.13, 0.12);
    }
    if (signatureBody) {
      const body = softBody(p.color);
      ball(body, p.pantsColor, 0, -0.21, 0.03, 0.32, 0.21, 0.25);
      box(body, 0.07, 0.42, 0.04, p.pantsColor, -0.13, -0.01, 0.255, 0.015).rotation.z = -0.15;
      ball(body, "#e8cf84", -0.1, 0.05, 0.29, 0.045, 0.045, 0.018);
      box(body, 0.23, 0.24, 0.16, "#8e5940", 0, -0.01, -0.29, 0.05);
      const propeller = part("propeller", torso);
      propeller.position.set(0, 0.02, -0.42);
      for (const angle of [0, Math.PI / 2])
        box(propeller, 0.75, 0.1, 0.055, "#b74832", 0, 0, 0, 0.04).rotation.z = angle;
      ball(propeller, "#e7c377", 0, 0, -0.04, 0.075, 0.075, 0.045);
      rig.secondary.push({ object: propeller, type: "propeller" });
    }
    paws(p.shoeColor);
  }
  if (id === "spongebob") {
    const g = newFace(p.skin, 1.02, 0.85, 0.58);
    const sponge = part("sponge-pores", g);
    for (const [x, y, r] of [[-0.42, 0.3, 0.055], [0.4, 0.29, 0.06], [-0.44, -0.18, 0.045], [0.44, -0.27, 0.065], [-0.3, -0.34, 0.035], [0.32, 0.38, 0.03]])
      ball(sponge, "#c0a42e", x, y, 0.294, r, r * 0.8, 0.012);
    rig.eyes.forEach((eye) => {
      eye.position.y = 0.1;
      eye.children.forEach((child) => (child.visible = false));
      ball(eye, "#fff9e6", 0, 0, 0.025, 0.19, 0.21, 0.06);
      ball(eye, "#64a7c2", 0, 0, 0.08, 0.095, 0.115, 0.025);
      ball(eye, "#212a32", 0, 0, 0.102, 0.052, 0.07, 0.012);
      ball(eye, "#ffffff", -0.02, 0.035, 0.115, 0.02, 0.025, 0.008);
      for (const x of [-0.1, 0, 0.1])
        box(eye, 0.018, 0.1, 0.018, "#33302b", x, 0.21, 0.025, 0.006).rotation.z = -x * 3;
    });
    rig.brows.forEach((b) => (b.visible = false));
    ball(g, p.skin, 0, -0.015, 0.41, 0.06, 0.13, 0.1);
    rig.mouth.position.set(0, -0.24, 0.32);
    rig.mouth.children.forEach((c) => (c.visible = false));
    box(rig.mouth, 0.38, 0.12, 0.04, "#9c6032", 0, 0, 0, 0.045);
    for (const s of [-1, 1]) {
      box(rig.mouth, 0.07, 0.1, 0.04, "#fff9e6", s * 0.047, 0.015, 0.025, 0.01);
      ball(g, "#e89b56", s * 0.34, -0.13, 0.31, 0.09, 0.045, 0.018);
    }
    if (signatureBody) {
      const body = garment("square-pants");
      box(body, 0.5, 0.19, 0.35, "#fff9e6", 0, 0.105, 0, 0.035);
      box(body, 0.51, 0.27, 0.36, p.pantsColor, 0, -0.12, 0, 0.035);
      polygon(body, [[0, 0.16], [-0.045, 0.04], [0, -0.02], [0.045, 0.04]], "#c73b36", 0.025, 0.19);
      for (const x of [-0.17, -0.06, 0.06, 0.17])
        box(body, 0.065, 0.025, 0.02, "#4f392b", x, -0.035, 0.19, 0.005);
    }
    if (signatureFeet) {
      knees.forEach((k) => {
        box(k, 0.16, 0.13, 0.18, "#fff9e6", 0, -0.045, 0, 0.03);
        for (const [y, color] of [[0, "#c73b36"], [-0.035, "#64a7c2"]])
          box(k, 0.165, 0.014, 0.185, color, 0, y, 0, 0.005);
      });
      paws(p.shoeColor);
    }
  }
  if (id === "reg") {
    if (signatureHead) {
      const g = part("relic-helmet");
      ball(g, "#6a5747", 0, 0.3, -0.035, 0.49, 0.32, 0.43);
      box(g, 0.88, 0.14, 0.79, "#947b5b", 0, 0.24, -0.01, 0.04);
      for (const s of [-1, 1]) {
        cylinder(g, "#705a45", 0.13, 0.13, 0.13, s * 0.46, 0.15, 0).rotation.z =
          Math.PI / 2;
        box(g, 0.16, 0.26, 0.2, "#ad956c", s * 0.44, 0.07, 0, 0.025);
      }
      ball(g, "#44382f", 0, 0.39, 0.385, 0.135, 0.13, 0.035);
      ball(g, glow("#c88c78"), 0, 0.39, 0.416, 0.075, 0.075, 0.012);
      cone(g, "#a78d69", 0.07, 0.2, 0.35, 0.57, -0.05, 5).rotation.z = -0.55;
    }
    if (signatureBody) {
      const g = garment();
      box(g, 0.43, 0.4, 0.33, p.skin, 0, -0.02, 0, 0.08);
      belt(g, "#705742");
      cloak(p.color);
      for (const [i, arm] of arms.entries()) {
        hideMeshes(arm);
        hideMeshes(elbows[i]);
        cylinder(arm, p.skin, 0.065, 0.065, 0.18, 0, -0.08, 0);
        cylinder(elbows[i], "#827667", 0.11, 0.1, 0.24, 0, -0.07, 0);
        for (const y of [0.02, -0.12])
          cylinder(elbows[i], "#b8a78b", 0.12, 0.12, 0.035, 0, y, 0);
        ball(elbows[i], "#756b5e", 0, -0.2, 0.01, 0.11, 0.095, 0.1);
      }
    }
    if (signatureFeet)
      feet.forEach((f) => {
        hideMeshes(f);
        box(f, 0.24, 0.26, 0.32, "#817566", 0, 0.045, 0.04, 0.05);
        box(f, 0.25, 0.045, 0.34, "#b6a488", 0, -0.06, 0.05, 0.01);
      });
  }
  if (id === "labubu") {
    const g = newFace(p.skin, 0.86, 0.76, 0.73);
    const fur = part("fur-head");
    box(fur, 1.02, 0.88, 0.76, p.color, 0, 0.01, -0.095, 0.23);
    // Face projects beyond the fur shell; the fringe is a separate ring of tufts.
    g.position.z = 0.12;
    furryEars(fur, p.color, "#d7b8a0", true);
    for (let i = 0; i < 13; i++) {
      const a = (i / 13) * Math.PI * 2;
      ball(
        fur,
        p.color,
        Math.sin(a) * 0.45,
        Math.cos(a) * 0.36,
        0.17,
        0.12,
        0.1,
        0.12,
      );
    }
    rig.mouth.position.set(0, -0.24, 0.43);
    rig.mouth.children.forEach((c) => (c.visible = false));
    box(rig.mouth, 0.51, 0.135, 0.05, "#4e302b", 0, 0, 0, 0.045);
    for (let i = 0; i < 9; i++) {
      const tooth = cone(
        rig.mouth,
        "#fff4d8",
        0.031,
        0.085,
        -0.216 + i * 0.054,
        0.006,
        0.043,
        3,
      );
      tooth.rotation.z = Math.PI;
      tooth.userData.tooth = true;
    }
    for (const s of [-1, 1])
      ball(g, "#dba79e", s * 0.28, -0.14, 0.41, 0.075, 0.045, 0.018);
    if (signatureBody) softBody(p.color, "#decab2");
    paws(p.color);
  }
  if (id === "batman") {
    // Dark cowl with a bare jaw, sharp white lenses, a pointed nose bridge and two tall ears; on the
    // chest the yellow bat oval, a gold utility belt with pouches, and a long scalloped cape.
    if (signatureHead) {
      const g = newFace("#2c303f", 0.9, 0.8, 0.77);
      // The exposed chin and set mouth.
      box(g, 0.44, 0.24, 0.07, p.skin, 0, -0.26, 0.39, 0.07);
      rig.mouth.position.set(0, -0.2, 0.46);
      rig.mouth.children.forEach((c) => (c.visible = false));
      box(rig.mouth, 0.2, 0.028, 0.03, "#7a5247", 0, 0, 0, 0.01);
      // Angled white eye lenses.
      rig.eyes.forEach((e, i) => {
        const s = i ? 1 : -1;
        e.children.forEach((c) => (c.visible = false));
        polygon(
          e,
          [
            [-s * 0.14, -0.02],
            [s * 0.12, 0.08],
            [s * 0.13, -0.01],
            [-s * 0.11, -0.05],
          ],
          glow("#f2f6f7"),
          0.03,
          0.045,
        );
      });
      // A small nose ridge between the brows.
      cone(g, "#242836", 0.05, 0.16, 0, 0.12, 0.4, 4).rotation.x = Math.PI / 2;
      const ears = part("bat-cowl");
      for (const s of [-1, 1])
        polygon(
          ears,
          [
            [s * 0.22, 0.24],
            [s * 0.37, 0.27],
            [s * 0.32, 0.92],
          ],
          "#242836",
          0.2,
          -0.11,
        );
    }
    if (signatureBody) {
      const g = garment();
      box(g, 0.47, 0.44, 0.35, p.color, 0, -0.03, 0, 0.08);
      // Chest muscle shaping.
      for (const s of [-1, 1]) ball(g, "#4b4f5e", s * 0.11, 0.08, 0.17, 0.11, 0.1, 0.03);
      cloak("#1f2230", true);
      // The yellow bat emblem: an oval with the black bat silhouette on it.
      ball(g, "#e6c052", 0, 0.03, 0.185, 0.17, 0.1, 0.015);
      polygon(
        g,
        [
          [-0.15, 0.03],
          [-0.08, 0.035],
          [-0.045, 0.075],
          [-0.015, 0.03],
          [0, 0.06],
          [0.015, 0.03],
          [0.045, 0.075],
          [0.08, 0.035],
          [0.15, 0.03],
          [0.11, -0.02],
          [0.05, -0.005],
          [0, -0.05],
          [-0.05, -0.005],
          [-0.11, -0.02],
        ],
        "#1c1f2b",
        0.02,
        0.2,
      );
      // Gold utility belt with pouches.
      box(g, 0.49, 0.09, 0.37, "#d8b65e", 0, -0.19, 0.01, 0.02);
      box(g, 0.1, 0.1, 0.03, "#b2903f", 0, -0.19, 0.215, 0.012);
      for (const x of [-0.17, -0.06, 0.06, 0.17])
        box(g, 0.07, 0.08, 0.04, "#c9a74f", x, -0.2, 0.2, 0.015);
      // Gauntlet fins.
      elbows.forEach((e, i) => {
        for (let j = 0; j < 3; j++)
          cone(e, "#242836", 0.035, 0.13, (i ? 1 : -1) * 0.11, -0.01 - j * 0.05, -0.02, 3).rotation.z = (i ? -1 : 1) * 1.1;
      });
    }
    paws("#1f2029");
  }
  if (id === "lego-boy") {
    const g = newFace(p.skin, 0.01, 0.01, 0.01);
    g.children.filter((c) => c.isMesh).forEach((c) => (c.visible = false));
    cylinder(g, p.skin, 0.39, 0.39, 0.66, 0, 0, 0);
    cylinder(g, p.skin, 0.16, 0.16, 0.13, 0, 0.395, 0);
    rig.eyes.forEach((e, i) => {
      e.position.set(i ? 0.155 : -0.155, 0.045, 0.363);
      e.children.forEach((c) => (c.visible = false));
      ball(e, "#29272a", 0, 0, 0, 0.045, 0.058, 0.018);
    });
    rig.brows.forEach((b) => (b.visible = false));
    rig.mouth.children.forEach((c) => (c.visible = false));
    rig.mouth.position.set(0, -0.075, 0.38);
    tube(
      rig.mouth,
      [
        [-0.11, 0, 0],
        [-0.07, -0.045, 0],
        [0, -0.065, 0],
        [0.07, -0.045, 0],
        [0.11, 0, 0],
      ],
      "#29272a",
      0.012,
    );
    if (signatureBody) {
      const body = garment();
      const chest = mesh(
        body,
        new T.CylinderGeometry(0.36, 0.29, 0.4, 4),
        p.color,
        0,
        -0.02,
        0,
      );
      chest.rotation.y = Math.PI / 4;
      chest.scale.z = 0.7;
      for (const [i, leg] of legs.entries()) {
        hideMeshes(leg);
        hideMeshes(knees[i]);
        box(leg, 0.21, 0.18, 0.23, p.pantsColor, 0, -0.06, 0, 0.008);
        box(knees[i], 0.21, 0.14, 0.23, p.pantsColor, 0, -0.05, 0, 0.008);
      }
      elbows.forEach((e) => {
        const grip = mesh(
          e,
          new T.TorusGeometry(0.07, 0.027, 8, 18, Math.PI * 1.5),
          p.skin,
          0,
          -0.15,
          0.015,
        );
        grip.rotation.z = -Math.PI / 4;
      });
      rig.hands.forEach((h) => (h.visible = false));
    }
    paws(p.pantsColor);
  }
  if (id === "builder" || id === "miner") {
    if (signatureHead)
      hardhat(id === "builder" ? "#f1c547" : "#c4a35f", id === "miner");
    if (signatureBody) {
      const g = garment();
      box(g, 0.46, 0.45, 0.35, p.color, 0, -0.03, 0, 0.06);
      if (id === "builder") {
        for (const s of [-1, 1])
          box(g, 0.055, 0.4, 0.03, "#f6e6ad", s * 0.13, -0.03, 0.19, 0.008);
        box(g, 0.45, 0.055, 0.03, "#f6e6ad", 0, -0.08, 0.205, 0.008);
      } else {
        box(g, 0.28, 0.28, 0.04, "#394c60", 0, -0.08, 0.19, 0.015);
        for (const s of [-1, 1])
          box(g, 0.045, 0.26, 0.025, "#b0a482", s * 0.15, 0.05, 0.19, 0.008);
        const pick = part("pickaxe", torso);
        pick.position.set(0.2, -0.04, -0.28);
        pick.rotation.z = -0.6;
        box(pick, 0.045, 0.57, 0.045, "#9e7855", 0, 0, 0, 0.009);
        box(pick, 0.4, 0.075, 0.06, "#8e98a1", 0, 0.23, 0, 0.02);
      }
      belt(g, "#71503a");
      for (const s of [-1, 1])
        box(g, 0.13, 0.16, 0.09, "#8d6746", s * 0.16, -0.18, 0.23, 0.02);
    }
    paws(p.shoeColor);
  }
  if (id === "doctor") {
    if (signatureHead) {
      const g = part("medical-cap");
      box(g, 0.8, 0.17, 0.7, "#75b7b3", 0, 0.35, -0.02, 0.07);
    }
    if (signatureBody) {
      const g = garment();
      box(g, 0.49, 0.58, 0.36, p.color, 0, -0.09, 0, 0.06);
      box(g, 0.16, 0.35, 0.025, "#67a9a4", 0, 0.04, 0.193, 0.02);
      for (const s of [-1, 1]) {
        const lapel = box(
          g,
          0.1,
          0.29,
          0.03,
          "#ffffff",
          s * 0.09,
          0.04,
          0.21,
          0.01,
        );
        lapel.rotation.z = s * 0.3;
        box(g, 0.13, 0.13, 0.025, "#dae2e6", s * 0.14, -0.23, 0.195, 0.01);
      }
      const stethoscope = part("stethoscope", torso);
      tube(
        stethoscope,
        [
          [-0.1, 0.17, 0.24],
          [-0.14, -0.02, 0.24],
          [-0.06, -0.12, 0.25],
          [0.1, -0.09, 0.25],
          [0.13, 0.17, 0.24],
        ],
        "#415262",
        0.015,
      );
      ball(
        stethoscope,
        "#a8bfcb",
        0.08,
        -0.17,
        0.255,
        0.045,
        0.045,
        0.02,
        0.15,
      );
      box(g, 0.06, 0.02, 0.015, "#54a59d", -0.14, -0.21, 0.22, 0.003);
      box(g, 0.02, 0.06, 0.015, "#54a59d", -0.14, -0.21, 0.22, 0.003);
    }
    paws(p.shoeColor);
  }
  if (id === "soldier") {
    if (signatureHead) {
      const g = hardhat("#66714d");
      box(g, 0.86, 0.07, 0.72, "#879365", 0, 0.18, 0.02, 0.02);
    }
    if (signatureBody) {
      const g = garment();
      box(g, 0.49, 0.46, 0.4, p.color, 0, -0.02, 0, 0.06);
      for (let i = 0; i < 8; i++)
        box(
          g,
          i % 2 ? 0.1 : 0.14,
          0.065,
          0.025,
          ["#a1a17c", "#3d4d38", "#907c54"][i % 3],
          ((i % 3) - 1) * 0.15,
          0.14 - Math.floor(i / 3) * 0.11,
          0.211,
          0.015,
        );
      for (const s of [-1, 1])
        box(g, 0.16, 0.17, 0.08, "#505b40", s * 0.115, -0.13, 0.25, 0.02);
      box(g, 0.41, 0.43, 0.2, "#7b8056", 0, 0.005, -0.28, 0.05);
      belt(g, "#404b35");
    }
    paws(p.shoeColor);
  }
  if (id === "robot") {
    const g = newFace(p.skin, 0.94, 0.75, 0.77);
    box(g, 0.78, 0.36, 0.055, "#263b4c", 0, 0.04, 0.39, 0.07);
    rig.eyes.forEach((e, i) => {
      e.children.forEach((c) => (c.visible = false));
      e.position.z = 0.43;
      box(e, 0.16, 0.15, 0.025, glow("#99efdf"), 0, 0, 0, 0.035);
    });
    rig.mouth.position.z = 0.435;
    rig.mouth.children.forEach((c) => (c.visible = false));
    for (let i = 0; i < 3; i++)
      box(
        rig.mouth,
        0.035,
        0.045,
        0.02,
        "#526b7c",
        -0.06 + i * 0.06,
        0,
        0,
        0.006,
      );
    if (signatureHead) {
      const antenna = part("antenna");
      cylinder(antenna, "#71879b", 0.025, 0.025, 0.22, 0, 0.48, 0);
      const lamp = ball(antenna, glow("#efb18e"), 0, 0.62, 0, 0.07);
      rig.secondary.push({ object: lamp, type: "light" });
    }
    if (signatureBody) {
      const body = garment();
      box(body, 0.48, 0.44, 0.37, p.color, 0, -0.025, 0, 0.045);
      box(body, 0.29, 0.23, 0.035, "#456175", 0, 0.015, 0.2, 0.02);
      for (let i = 0; i < 3; i++)
        box(
          body,
          0.15,
          0.018,
          0.02,
          "#9ed9d6",
          0,
          0.07 - i * 0.05,
          0.226,
          0.004,
        );
      ball(body, glow("#f0aa80"), 0.14, -0.13, 0.22, 0.035);
      for (const [i, arm] of arms.entries()) {
        ball(arm, "#566a7d", 0, 0.01, 0, 0.11);
        cylinder(elbows[i], "#c5d2d9", 0.095, 0.095, 0.12, 0, -0.035, 0);
      }
    }
    paws(p.shoeColor);
  }
  if (["penguin", "wolf", "lion"].includes(id)) {
    const g = newFace(p.skin, 0.91, 0.79, 0.76);
    if (id === "penguin") {
      for (const s of [-1, 1])
        ball(g, "#f5eee3", s * 0.205, 0.02, 0.38, 0.195, 0.27, 0.052);
      rig.eyes.forEach((e) => {
        e.position.z = 0.435;
        e.children[0].scale.set(0.08, 0.1, 0.04);
        e.children[1].position.z = 0.038;
      });
      rig.mouth.visible = false;
      const beak = cone(g, "#e9a044", 0.14, 0.27, 0, -0.13, 0.5, 4);
      beak.rotation.x = Math.PI / 2;
      beak.scale.x = 0.9;
      if (signatureBody) {
        softBody(p.color, "#f2eee7");
        arms.forEach((a, i) => {
          hideMeshes(a);
          hideMeshes(elbows[i]);
          ball(a, p.color, 0, -0.15, 0, 0.11, 0.26, 0.1);
          ball(elbows[i], p.color, 0, -0.07, 0, 0.085, 0.17, 0.08);
        });
      }
      paws("#e9a044", true);
    } else {
      const muzzle = part("muzzle");
      box(
        muzzle,
        0.43,
        0.25,
        0.26,
        id === "wolf" ? "#d3d9dc" : "#f0d29a",
        0,
        -0.18,
        0.43,
        0.09,
      );
      ball(muzzle, "#352c31", 0, -0.105, 0.58, 0.095, 0.065, 0.045);
      rig.mouth.position.set(0, -0.285, 0.577);
      if (id === "wolf") {
        furryEars(g, p.skin, "#c9b8b7");
        tail(p.color, "#e4e4df");
      } else {
        const mane = part("mane");
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          ball(
            mane,
            i % 2 ? "#a76a36" : "#be7c3c",
            Math.sin(a) * 0.47,
            Math.cos(a) * 0.43,
            -0.035,
            0.19,
            0.2,
            0.27,
          );
        }
        for (const s of [-1, 1]) {
          ball(g, p.skin, s * 0.4, 0.34, 0.05, 0.13, 0.13, 0.1);
          ball(g, "#986a48", s * 0.4, 0.34, 0.14, 0.065, 0.065, 0.02);
        }
        tail(p.color, "#9d6036");
      }
      if (signatureBody)
        softBody(p.color, id === "wolf" ? "#c9d0d3" : "#efd09b");
      paws(p.color);
    }
  }
  if (id === "flame-princess") {
    if (signatureHead) {
      const gem = part("flame-gem");
      box(gem, 0.11, 0.13, 0.04, "#c63e37", 0, 0.24, 0.375, 0.01).rotation.z =
        Math.PI / 4;
    }
    if (signatureBody) {
      const g = garment();
      cylinder(g, p.color, 0.2, 0.37, 0.57, 0, -0.09, 0).scale.z = 0.8;
      box(g, 0.4, 0.055, 0.31, "#f3bc52", 0, 0.04, 0, 0.01);
    }
    paws(p.skin);
  }
  if (id === "ice-king") {
    const beard = part("white-beard");
    const b = cone(beard, "#f2f1ec", 0.28, 0.7, 0, -0.48, 0.32, 12);
    b.rotation.z = Math.PI;
    b.scale.z = 0.5;
    for (const s of [-1, 1]) {
      ball(beard, "#f4f3ed", s * 0.12, -0.19, 0.42, 0.18, 0.07, 0.06);
      ball(beard, "#f4f3ed", s * 0.39, 0.02, -0.06, 0.13, 0.38, 0.18);
    }
    const nose = cone(beard, p.skin, 0.085, 0.29, 0, -0.045, 0.51, 10);
    nose.rotation.x = Math.PI / 2;
    if (signatureHead) {
      const crown = part("ice-crown");
      cylinder(crown, "#e7be4f", 0.42, 0.42, 0.12, 0, 0.38, 0);
      for (const x of [-0.3, 0, 0.3]) {
        cone(
          crown,
          "#f1c952",
          0.115,
          x === 0 ? 0.38 : 0.27,
          x,
          x === 0 ? 0.6 : 0.54,
          0,
          4,
        );
        box(crown, 0.075, 0.12, 0.04, "#c7555d", x, 0.42, 0.37, 0.015);
      }
    }
    if (signatureBody) {
      const g = garment();
      cylinder(g, p.color, 0.22, 0.37, 0.64, 0, -0.12, 0).scale.z = 0.8;
    }
    paws(p.shoeColor);
  }
  if (id === "astronaut") {
    if (signatureHead) {
      const g = part("space-helmet");
      box(g, 1.04, 0.96, 0.88, "#e8edf2", 0, 0.015, -0.035, 0.26);
      box(g, 0.83, 0.61, 0.16, "#26394f", 0, -0.005, 0.42, 0.19);
      ball(g, "#83b4ca", -0.22, 0.16, 0.505, 0.12, 0.08, 0.012);
      for (const s of [-1, 1])
        box(g, 0.15, 0.29, 0.4, "#adbacb", s * 0.53, 0.01, -0.01, 0.07);
    }
    const tanks = part("oxygen", torso);
    for (const s of [-1, 1])
      cylinder(tanks, "#a7b7c6", 0.1, 0.1, 0.38, s * 0.12, 0, -0.38);
  }
  if (id === "samurai") {
    if (signatureHead) {
      const g = hardhat("#493c48");
      for (const s of [-1, 1]) {
        const horn = cone(g, "#d6b36c", 0.075, 0.37, s * 0.22, 0.59, 0.2, 5);
        horn.rotation.z = -s * 0.65;
      }
      box(g, 0.77, 0.13, 0.16, "#ae5757", 0, 0.23, 0.4, 0.03);
    }
    if (signatureBody) {
      const g = garment();
      box(g, 0.45, 0.41, 0.36, "#443643", 0, -0.02, 0, 0.06);
      for (let i = 0; i < 4; i++)
        box(g, 0.45, 0.075, 0.08, p.color, 0, 0.13 - i * 0.105, 0.21, 0.015);
      for (const s of [-1, 1])
        for (let i = 0; i < 3; i++)
          box(
            arms[s === -1 ? 0 : 1],
            0.24,
            0.07,
            0.27,
            p.color,
            s * 0.025,
            0.03 - i * 0.07,
            0,
            0.018,
          );
      belt(g, "#d0ad6a");
    }
    paws(p.shoeColor);
  }
  if (id === "pirate") {
    if (signatureHead) {
      const g = part("tricorn");
      box(g, 0.84, 0.12, 0.72, "#b35754", 0, 0.27, 0, 0.04);
      ball(g, "#34323c", 0, 0.42, -0.02, 0.45, 0.22, 0.34);
      polygon(
        g,
        [
          [-0.67, 0.32],
          [-0.36, 0.62],
          [0, 0.42],
          [0.36, 0.62],
          [0.67, 0.32],
        ],
        "#34323c",
        0.4,
        -0.1,
      );
      tube(
        g,
        [
          [-0.64, 0.33, 0.32],
          [-0.35, 0.59, 0.32],
          [0, 0.41, 0.32],
          [0.35, 0.59, 0.32],
          [0.64, 0.33, 0.32],
        ],
        "#c4a46b",
        0.016,
      );
      ball(g, "#272630", 0.21, 0.04, 0.43, 0.16, 0.13, 0.04);
      tube(
        g,
        [
          [-0.38, 0.2, 0.37],
          [0, 0.13, 0.42],
          [0.4, -0.06, 0.37],
        ],
        "#41313a",
        0.016,
      );
      const ring = mesh(
        g,
        new T.TorusGeometry(0.075, 0.016, 8, 20),
        "#dcb96a",
        -0.44,
        -0.13,
        0.06,
      );
      ring.rotation.y = 0.2;
    }
    if (signatureBody) {
      const g = garment();
      box(g, 0.48, 0.5, 0.36, p.color, 0, -0.06, 0, 0.055);
      box(g, 0.22, 0.38, 0.025, "#eee1ce", 0, 0.02, 0.19, 0.015);
      for (let i = 0; i < 4; i++)
        box(g, 0.22, 0.036, 0.022, "#a95456", 0, 0.15 - i * 0.09, 0.21, 0.006);
      belt(g, "#70513a");
    }
    paws(p.shoeColor);
  }
  if (id === "forest-spirit") {
    const g = newFace(p.skin, 0.83, 0.82, 0.69);
    rig.eyes.forEach((e) => {
      e.children[0].material = glow("#e5dc9f");
    });
    if (signatureHead) {
      const leaves = part("leaf-crown");
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4;
        const leaf = ball(
          leaves,
          i % 2 ? "#729e66" : "#a8bd78",
          Math.sin(a) * 0.32,
          0.37 + (i % 3) * 0.13,
          Math.cos(a) * 0.22,
          0.12,
          0.22,
          0.055,
        );
        leaf.rotation.z = Math.sin(a) * 0.8;
        rig.secondary.push({
          object: leaf,
          type: "leaf",
          seed: i,
          base: leaf.rotation.z,
        });
      }
      for (const s of [-1, 1])
        tube(
          leaves,
          [
            [s * 0.28, 0.3, -0.1],
            [s * 0.42, 0.65, -0.1],
            [s * 0.5, 0.78, -0.09],
          ],
          "#8d7352",
          0.035,
        );
    }
    if (signatureBody) {
      const body = garment();
      box(body, 0.45, 0.45, 0.35, "#927b59", 0, -0.025, 0, 0.09);
      for (let i = 0; i < 7; i++) {
        const leaf = ball(
          body,
          p.color,
          ((i % 3) - 1) * 0.13,
          0.13 - Math.floor(i / 3) * 0.12,
          0.19,
          0.13,
          0.16,
          0.04,
        );
        leaf.rotation.z = i % 2 ? 0.7 : -0.7;
      }
      for (const s of [-1, 1])
        box(body, 0.018, 0.27, 0.02, "#655442", s * 0.15, -0.05, 0.18, 0.004);
    }
    paws(p.shoeColor);
  }
  if (id === "spiderman") {
    // Full red-and-blue mask: big white lenses with a black rim, web lines, a spider on the chest.
    const g = newFace(p.color, 0.86, 0.78, 0.74);
    rig.mouth.visible = false;
    rig.brows.forEach((b) => (b.visible = false));
    rig.eyes.forEach((e, i) => {
      const s = i ? 1 : -1;
      e.children.forEach((c) => (c.visible = false));
      polygon(e, [[-s * 0.2, -0.04], [s * 0.05, 0.17], [s * 0.21, 0.04], [s * 0.11, -0.11], [-s * 0.13, -0.09]], "#111318", 0.03, 0.03);
      polygon(e, [[-s * 0.16, -0.02], [s * 0.04, 0.13], [s * 0.16, 0.03], [s * 0.08, -0.08], [-s * 0.1, -0.07]], glow("#eef2f0"), 0.03, 0.06);
    });
    // Web lines fanning down the mask and a few rings across.
    const web = part("web");
    for (let i = 0; i < 7; i++) {
      const a = -0.7 + i * 0.23;
      tube(web, [[Math.sin(a) * 0.05, 0.34, 0.35], [Math.sin(a) * 0.26, 0.02, 0.33], [Math.sin(a) * 0.4, -0.3, 0.2]], "#7a1418", 0.006);
    }
    for (const r of [0.14, 0.26, 0.37])
      tube(web, [[-r, 0.26 - r, 0.34], [-r * 0.5, 0.3 - r, 0.4], [0, 0.32 - r, 0.42], [r * 0.5, 0.3 - r, 0.4], [r, 0.26 - r, 0.34]], "#7a1418", 0.006);
    if (signatureBody) {
      const body = garment();
      box(body, 0.45, 0.43, 0.34, p.color, 0, -0.03, 0, 0.08);
      // Blue flanks and a blue lower half.
      for (const s of [-1, 1]) box(body, 0.09, 0.44, 0.34, p.pantsColor, s * 0.2, -0.03, 0, 0.05);
      box(body, 0.46, 0.14, 0.35, p.pantsColor, 0, -0.2, 0, 0.06);
      // The black spider: body and eight legs.
      ball(body, "#15171d", 0, 0.06, 0.18, 0.04, 0.07, 0.02);
      for (const s of [-1, 1])
        for (let j = 0; j < 4; j++) {
          const y = 0.12 - j * 0.045;
          tube(body, [[0, 0.06, 0.185], [s * 0.08, y, 0.2], [s * 0.15, y - 0.03, 0.18]], "#15171d", 0.006);
        }
      for (const [i, leg] of legs.entries()) {
        hideMeshes(leg);
        hideMeshes(knees[i]);
        box(leg, 0.19, 0.2, 0.22, p.pantsColor, 0, -0.06, 0, 0.05);
        box(knees[i], 0.18, 0.16, 0.21, p.pantsColor, 0, -0.05, 0, 0.05);
      }
      // Red gloves over the forearms and webs across them.
      elbows.forEach((e) => box(e, 0.2, 0.2, 0.2, p.color, 0, -0.08, 0, 0.05));
    }
    feet.forEach((f) => {
      hideMeshes(f);
      box(f, 0.25, 0.14, 0.33, p.color, 0, -0.005, 0.06, 0.05);
    });
  }
  if (id === "trump") {
    // A big blond comb-over swept forward and to the side over the base hair, a navy suit, red tie.
    const hair = part("combover");
    const crest = box(hair, 0.92, 0.3, 0.6, p.hairColor, 0.04, 0.44, 0.1, 0.15);
    crest.rotation.z = -0.12;
    crest.rotation.x = 0.22;
    box(hair, 0.52, 0.18, 0.24, p.hairColor, -0.2, 0.5, 0.26, 0.08).rotation.z = 0.28;
    if (signatureBody) {
      const g = garment();
      box(g, 0.47, 0.5, 0.35, p.color, 0, -0.07, 0, 0.08);
      // White shirt and a long red tie down the front.
      box(g, 0.18, 0.44, 0.03, "#f3f1ee", 0, -0.04, 0.17, 0.015);
      box(g, 0.075, 0.46, 0.03, "#cf2634", 0, -0.12, 0.185, 0.012);
      box(g, 0.1, 0.1, 0.035, "#cf2634", 0, 0.12, 0.185, 0.015).rotation.z = Math.PI / 4;
      for (const s of [-1, 1]) {
        const lapel = box(g, 0.1, 0.32, 0.04, p.color, s * 0.1, 0.03, 0.2, 0.01);
        lapel.rotation.z = s * 0.3;
      }
    }
  }
  if (id === "messi") {
    // A trimmed beard over the base short hair, the sky-blue-and-white striped Argentina shirt with 10.
    const beard = part("beard");
    for (const s of [-1, 1]) box(beard, 0.09, 0.3, 0.14, p.hairColor, s * 0.38, -0.12, 0.3, 0.04);
    box(beard, 0.5, 0.12, 0.12, p.hairColor, 0, -0.33, 0.33, 0.05);
    box(beard, 0.3, 0.09, 0.1, p.hairColor, 0, -0.18, 0.42, 0.04);
    if (signatureBody) {
      const g = garment();
      box(g, 0.47, 0.44, 0.35, "#eef3f6", 0, -0.03, 0, 0.08);
      for (let i = 0; i < 4; i++) box(g, 0.08, 0.44, 0.03, p.color, -0.18 + i * 0.12, -0.03, 0.175, 0.01);
      // Number 10 on the chest.
      box(g, 0.03, 0.14, 0.02, "#1d3f6e", -0.08, 0.02, 0.19, 0.006);
      mesh(g, new T.TorusGeometry(0.055, 0.02, 8, 16), material("#1d3f6e"), 0.04, 0.02, 0.19).scale.z = 0.4;
      for (const [i, leg] of legs.entries()) {
        hideMeshes(leg);
        box(leg, 0.2, 0.2, 0.23, p.pantsColor, 0, -0.06, 0, 0.05);
      }
    }
  }
  if (id === "dualipa") {
    // Long dark hair past the shoulders, bold lips, a bright crop top and hoop earrings.
    const extra = part("long-hair");
    for (const s of [-1, 1]) {
      box(extra, 0.17, 0.95, 0.24, p.hairColor, s * 0.4, -0.3, -0.06, 0.07);
      const hoop = mesh(extra, new T.TorusGeometry(0.07, 0.016, 8, 18), material("#e7c45a"), s * 0.47, -0.16, 0.12);
      hoop.rotation.y = Math.PI / 2;
    }
    box(extra, 0.78, 0.8, 0.22, p.hairColor, 0, -0.26, -0.33, 0.08);
    if (signatureBody) {
      const g = garment();
      box(g, 0.44, 0.26, 0.33, p.color, 0, 0.06, 0, 0.08);
      box(g, 0.46, 0.2, 0.34, "#1b1d24", 0, -0.14, 0, 0.07);
      for (const s of [-1, 1]) box(g, 0.05, 0.18, 0.06, p.color, s * 0.13, 0.17, 0.08, 0.02);
    }
  }
  if (id === "jon-snow") {
    // A short beard over the base curly hair, a heavy black fur mantle over leather.
    const beard = part("beard");
    for (const s of [-1, 1]) box(beard, 0.1, 0.32, 0.15, p.hairColor, s * 0.37, -0.12, 0.3, 0.05);
    box(beard, 0.56, 0.16, 0.14, p.hairColor, 0, -0.32, 0.33, 0.06);
    if (signatureBody) {
      const g = garment();
      box(g, 0.47, 0.47, 0.36, "#3b332e", 0, -0.05, 0, 0.07);
      box(g, 0.12, 0.42, 0.03, "#2a2420", 0, -0.04, 0.18, 0.012);
      // Black fur mantle: a thick ruff of dark tufts over the shoulders.
      const fur = part("fur-mantle", torso);
      fur.position.set(0, 0.16, 0);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        ball(fur, p.color, Math.sin(a) * 0.34, 0.02 + Math.cos(a * 2) * 0.03, Math.cos(a) * 0.26 - 0.02, 0.12, 0.15, 0.12);
      }
      rig.secondary.push({ object: fur, type: "ear", side: 0 });
      // A sword hilt over the shoulder.
      const hilt = part("sword", torso);
      cylinder(hilt, "#4a4036", 0.03, 0.03, 0.26, -0.26, 0.3, -0.24).rotation.z = 0.4;
      box(hilt, 0.14, 0.03, 0.03, "#8a7a52", -0.3, 0.42, -0.24, 0.01).rotation.z = 0.4;
    }
    feet.forEach((f) => {
      hideMeshes(f);
      box(f, 0.25, 0.2, 0.34, p.shoeColor, 0, 0.02, 0.05, 0.05);
    });
  }
  if (p.headwear === "bear")
    head.children
      .filter((c) => !baseHeadChildren.has(c))
      .forEach((c) => (c.visible = false));
  rig.root.userData.character = id;
}

export function animateCharacter(rig, time) {
  for (const { object, type, side = 1, seed = 0, base = 0 } of rig.secondary ||
    []) {
    if (type === "cape")
      object.rotation.x =
        base + Math.sin(time * 2.7) * 0.045 + (rig.motion?.blend || 0) * 0.28;
    if (type === "tail")
      object.rotation.y =
        Math.sin(time * 3.5) * (0.18 + (rig.motion?.blend || 0) * 0.25);
    if (type === "ear") object.rotation.z = Math.sin(time * 2.2 + side) * 0.018;
    if (type === "leaf")
      object.rotation.z = base + Math.sin(time * 2.5 + seed) * 0.1;
    if (type === "light")
      object.material.emissiveIntensity = 0.65 + Math.sin(time * 3) * 0.25;
    if (type === "propeller") object.rotation.z = time * 18;
  }
}
