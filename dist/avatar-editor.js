import * as T from "three";
import {
  avatar,
  normalizeProfile,
  HAIRSTYLES,
  HEADWEAR,
  OUTFITS,
  FOOTWEAR,
  LOOKS,
  material,
  disposeAvatar,
} from "./avatars.js";
import { animateRig } from "./animation.js";

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const options = (field, values, profile) =>
  `<div class="wardrobe-options">${values.map(([id, name]) => `<button type="button" data-choice="${field}" data-value="${id}" class="${profile[field] === id ? "selected" : ""}" aria-pressed="${profile[field] === id}">${name}</button>`).join("")}</div>`;
const swatches = (field, values, profile) =>
  `<div class="editor-colors">${values.map((color) => `<button type="button" data-choice="${field}" data-value="${color}" class="color ${profile[field] === color ? "selected" : ""}" style="background:${color}" aria-label="${field} ${color}"></button>`).join("")}<label class="custom-color" title="Выбрать цвет"><input type="color" data-custom="${field}" value="${profile[field] || values[0]}" aria-label="Свой цвет ${field}">+</label></div>`;

export function editorMarkup(profile) {
  return `<div class="avatar-editor"><section class="character-stage"><canvas id="avatarPreviewCanvas" aria-label="3D-просмотр персонажа. Потяните мышью для вращения."></canvas><div class="preview-name">${escape(profile.name)}</div><div class="preview-controls"><button type="button" data-preview="left" aria-label="Повернуть влево">↶</button><span>Потяните, чтобы повернуть</span><button type="button" data-preview="right" aria-label="Повернуть вправо">↷</button></div></section><form id="avatarForm" class="customizer"><div class="editor-name"><label for="avatarName">Имя персонажа</label><input id="avatarName" maxlength="24" value="${escape(profile.name)}" required></div><div class="editor-tabs" role="tablist">${[
    ["looks", "Образы"],
    ["head", "Голова"],
    ["outfit", "Одежда"],
    ["shoes", "Обувь"],
  ]
    .map(
      ([id, label]) =>
        `<button type="button" role="tab" data-editor-tab="${id}" aria-selected="${id === "looks"}">${label}</button>`,
    )
    .join(
      "",
    )}</div><div id="wardrobePanel" class="wardrobe-panel"></div><div class="editor-actions"><button class="secondary" type="button" data-action="close">Отмена</button><button class="primary" type="submit">Сохранить образ</button></div></form></div>`;
}

export class AvatarEditor {
  constructor(container, profile, onSave, Renderer = T.WebGLRenderer) {
    this.container = container;
    this.draft = normalizeProfile({ ...profile });
    this.tab = "looks";
    this.yaw = -0.3;
    this.scene = new T.Scene();
    this.scene.add(new T.HemisphereLight("#fff1fa", "#62516d", 2.8));
    const light = new T.DirectionalLight("#fff2de", 3.6);
    light.position.set(-3, 5, 4);
    this.scene.add(light);
    const fill = new T.DirectionalLight("#baa1f2", 1.8);
    fill.position.set(3, 2, -3);
    this.scene.add(fill);
    const pedestal = new T.Mesh(
      new T.CylinderGeometry(0.73, 0.81, 0.08, 64),
      material("#75638a"),
    );
    pedestal.position.y = -0.085;
    this.scene.add(pedestal);
    const ring = new T.Mesh(
      new T.TorusGeometry(0.76, 0.008, 6, 60),
      new T.MeshBasicMaterial({ color: "#d9baff" }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.04;
    this.scene.add(ring);
    this.camera = new T.PerspectiveCamera(31, 1, 0.1, 20);
    this.camera.position.set(0, 1.3, 4.4);
    this.camera.lookAt(0, 0.87, 0);
    this.canvas = container.querySelector("#avatarPreviewCanvas");
    this.window = container.ownerDocument.defaultView;
    this.renderer = new Renderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(this.window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.rebuild();
    this.renderPanel();
    this.resize = () => {
      const rect = this.canvas.getBoundingClientRect();
      const width = rect.width || 360,
        height = rect.height || 500;
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    };
    this.resize();
    this.window.addEventListener("resize", this.resize);
    this.observer = this.window.ResizeObserver
      ? new this.window.ResizeObserver(this.resize)
      : null;
    this.observer?.observe(this.canvas);
    this.canvas.addEventListener("pointerdown", (event) => {
      this.drag = { x: event.clientX, yaw: this.yaw };
      this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener("pointermove", (event) => {
      if (this.drag)
        this.yaw = this.drag.yaw + (event.clientX - this.drag.x) * 0.012;
    });
    this.canvas.addEventListener("pointerup", () => (this.drag = null));
    this.canvas.addEventListener("pointercancel", () => (this.drag = null));
    container.querySelector("#avatarForm").onsubmit = (event) => {
      event.preventDefault();
      this.draft.name =
        container.querySelector("#avatarName").value.trim() || "Вы";
      onSave({ ...this.draft });
    };
    container.onclick = (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.dataset.editorTab) {
        this.tab = button.dataset.editorTab;
        this.renderPanel();
      }
      if (button.dataset.choice) {
        this.draft[button.dataset.choice] =
          button.dataset.choice === "glasses"
            ? button.dataset.value === "true"
            : button.dataset.value;
        this.rebuild();
        this.renderPanel();
      }
      if (button.dataset.look) {
        const { id, ...look } = LOOKS.find((l) => l.id === button.dataset.look);
        this.draft = { ...this.draft, ...look, lookId: id };
        this.rebuild();
        this.renderPanel();
      }
      if (button.dataset.preview)
        this.yaw += button.dataset.preview === "left" ? -0.5 : 0.5;
    };
    container.oninput = (event) => {
      if (event.target.id === "avatarName") {
        this.draft.name = event.target.value;
        container.querySelector(".preview-name").textContent = this.draft.name;
      }
      if (event.target.dataset.custom) {
        this.draft[event.target.dataset.custom] = event.target.value;
        this.rebuild();
      }
    };
  }
  rebuild() {
    if (this.rig) {
      this.scene.remove(this.rig.root);
      disposeAvatar(this.rig);
    }
    this.rig = avatar(this.draft);
    this.scene.add(this.rig.root);
  }
  renderPanel() {
    const p = this.draft,
      panel = this.container.querySelector("#wardrobePanel");
    this.container
      .querySelectorAll("[data-editor-tab]")
      .forEach((button) =>
        button.setAttribute(
          "aria-selected",
          button.dataset.editorTab === this.tab,
        ),
      );
    if (this.tab === "looks")
      panel.innerHTML = `<p class="wardrobe-description">Начните с образа и настройте каждую деталь.</p><div class="looks-grid">${LOOKS.map((look, i) => `<button type="button" data-look="${look.id}" class="look-card ${p.lookId === look.id ? "selected" : ""}"><span style="--look-color:${look.color}" class="look-glyph">${["✦", "◉", "☆", "♨", "ʕ•ᴥ•ʔ", "❄"][i]}</span><strong>${look.name}</strong></button>`).join("")}</div>`;
    if (this.tab === "head")
      panel.innerHTML = `<label class="field-label">Кожа</label>${swatches("skin", ["#edbda1", "#e4b59b", "#bd8f70", "#90634d", "#5e4135"], p)}<label class="field-label">Причёска</label>${options("hairstyle", HAIRSTYLES, p)}<label class="field-label">Цвет волос</label>${swatches("hairColor", ["#493339", "#292530", "#a16d44", "#d6ae6c", "#a88cae"], p)}<label class="field-label">Головной убор</label>${options("headwear", HEADWEAR, p)}<label class="field-label">Очки</label>${options(
        "glasses",
        [
          ["false", "Без очков"],
          ["true", "В очках"],
        ],
        { glasses: String(p.glasses) },
      )}`;
    if (this.tab === "outfit")
      panel.innerHTML = `<label class="field-label">Одежда</label>${options("outfit", OUTFITS, p)}<label class="field-label">Основной цвет</label>${swatches("color", ["#ae92d6", "#9eb493", "#d99e86", "#c69eaf", "#89a4bf", "#e7e3ed"], p)}<label class="field-label">Цвет брюк</label>${swatches("pantsColor", ["#454050", "#312e38", "#9d91a9", "#5f4b3b", "#d8d3e3"], p)}`;
    if (this.tab === "shoes")
      panel.innerHTML = `<label class="field-label">Обувь</label>${options("footwear", FOOTWEAR, p)}<label class="field-label">Цвет обуви</label>${swatches("shoeColor", ["#f0e9f0", "#302a38", "#aa8063", "#aa8dd5", "#91b6ac"], p)}`;
    if (typeof this.draft.glasses === "string")
      this.draft.glasses = this.draft.glasses === "true";
  }
  update(time, dt) {
    if (this.disposed) return;
    animateRig(
      this.rig,
      { time, grounded: true, speed: 0, lookPitch: -0.025 },
      dt,
    );
    this.rig.root.rotation.y = this.yaw;
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.observer?.disconnect();
    this.window.removeEventListener("resize", this.resize);
    this.container.onclick = null;
    this.container.oninput = null;
    disposeAvatar(this.rig);
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
  }
}
