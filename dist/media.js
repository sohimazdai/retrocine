// Voice, cameras and screen sharing through the LiveKit SFU on api.sohimazdai.ru.
// The SDK is loaded on demand, so the room works (silently) even if media is unavailable.
const SINK_ID = "mediaSink";

export class Media {
  constructor({ onVideo = () => {}, onSpeakers = () => {}, onLocal = () => {}, onStatus = () => {}, toast = () => {} } = {}) {
    Object.assign(this, { onVideo, onSpeakers, onLocal, onStatus, toast });
    this.room = null;
    this.LK = null;
    this.want = { mic: false, cam: false, screen: false };
    this.elements = new Map();
  }
  get ready() {
    return !!this.room && this.room.state === "connected";
  }
  sink() {
    let el = document.getElementById(SINK_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = SINK_ID;
      el.setAttribute("aria-hidden", "true");
      el.style.cssText = "position:fixed;left:0;top:0;width:2px;height:2px;overflow:hidden;opacity:0;pointer-events:none";
      document.body.append(el);
    }
    return el;
  }
  async connect(url, token, identity) {
    // The sync server reissues a token on every reconnect; keep a live media session as it is.
    if (this.room && this.identity === identity && this.room.state !== "disconnected") return;
    if (this.connecting === identity) return;
    this.connecting = identity;
    this.token = token;
    this.identity = identity;
    try {
      this.LK ||= await import("./vendor/livekit-client.min.js");
    } catch (e) {
      this.connecting = null;
      this.onStatus("unavailable");
      return;
    }
    const { Room, RoomEvent, Track, VideoPresets, ScreenSharePresets } = this.LK;
    await this.disconnect(true);
    const room = new Room({
      adaptiveStream: false,
      dynacast: true,
      disconnectOnPageLeave: true,
      audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      videoCaptureDefaults: { resolution: VideoPresets.h540.resolution },
      publishDefaults: {
        simulcast: true,
        videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
        screenShareEncoding: ScreenSharePresets.h1080fps15.encoding,
        dtx: true,
        red: true,
      },
    });
    this.room = room;
    const source = (pub) =>
      pub.source === Track.Source.ScreenShare ? "screen" : pub.source === Track.Source.Camera ? "camera" : pub.source;
    room
      .on(RoomEvent.TrackSubscribed, (track, pub, participant) => this.attach(track, participant.identity, source(pub)))
      .on(RoomEvent.TrackUnsubscribed, (track, pub, participant) => this.detach(track, participant.identity, source(pub)))
      .on(RoomEvent.TrackMuted, (pub, participant) => {
        if (pub.kind === "video") this.onVideo(this.who(participant), source(pub), null);
      })
      .on(RoomEvent.TrackUnmuted, (pub, participant) => {
        if (pub.kind === "video" && pub.track) this.attach(pub.track, participant.identity, source(pub));
      })
      .on(RoomEvent.LocalTrackPublished, (pub) => {
        if (pub.kind === "video") this.attach(pub.track, room.localParticipant.identity, source(pub));
        this.reportLocal();
      })
      .on(RoomEvent.LocalTrackUnpublished, (pub) => {
        if (pub.kind === "video") this.onVideo("self", source(pub), null);
        if (source(pub) === "screen") this.want.screen = false;
        this.reportLocal();
      })
      .on(RoomEvent.ActiveSpeakersChanged, (speakers) =>
        this.onSpeakers(new Set(speakers.map((p) => this.who(p)))),
      )
      .on(RoomEvent.AudioPlaybackStatusChanged, () => {
        if (!room.canPlaybackAudio) this.toast("Кликните в комнате, чтобы включить звук собеседников");
      })
      .on(RoomEvent.Reconnecting, () => this.onStatus("reconnecting"))
      .on(RoomEvent.Reconnected, () => this.onStatus("connected"))
      .on(RoomEvent.Disconnected, () => {
        if (this.room === room) this.onStatus("disconnected");
      });
    try {
      await room.connect(url, token, { autoSubscribe: true });
      this.onStatus("connected");
      // After a reconnect with a new token, publish what the person had switched on.
      if (this.want.mic) await this.setMic(true);
      if (this.want.cam) await this.setCam(true);
    } catch (e) {
      this.onStatus("unavailable");
      console.warn("LiveKit:", e?.message || e);
    } finally {
      this.connecting = null;
    }
  }
  who(participant) {
    return participant === this.room?.localParticipant || participant.identity === this.room?.localParticipant?.identity
      ? "self"
      : participant.identity;
  }
  attach(track, identity, kind) {
    const id = identity === this.room?.localParticipant?.identity ? "self" : identity;
    if (track.kind === "audio") {
      if (id === "self") return;
      const el = track.attach();
      this.sink().append(el);
      this.elements.set(track.sid || el, el);
      return;
    }
    const el = track.attach();
    el.muted = true;
    el.playsInline = true;
    el.autoplay = true;
    this.sink().append(el);
    el.play?.().catch(() => {});
    this.elements.set(track.sid || el, el);
    this.onVideo(id, kind, el);
  }
  detach(track, identity, kind) {
    for (const el of track.detach()) el.remove();
    this.elements.delete(track.sid);
    if (track.kind === "video") this.onVideo(identity, kind, null);
  }
  reportLocal() {
    const lp = this.room?.localParticipant;
    this.onLocal({
      mic: !!lp?.isMicrophoneEnabled,
      cam: !!lp?.isCameraEnabled,
      screen: !!lp?.isScreenShareEnabled,
    });
  }
  async setMic(on) {
    this.want.mic = on;
    await this.room.localParticipant.setMicrophoneEnabled(on);
    this.reportLocal();
  }
  async setCam(on) {
    this.want.cam = on;
    await this.room.localParticipant.setCameraEnabled(on);
    if (!on) this.onVideo("self", "camera", null);
    this.reportLocal();
  }
  async setShare(on) {
    this.want.screen = on;
    await this.room.localParticipant.setScreenShareEnabled(on, { audio: false, contentHint: "detail" });
    if (!on) this.onVideo("self", "screen", null);
    this.reportLocal();
  }
  startAudio() {
    if (this.room && !this.room.canPlaybackAudio) this.room.startAudio().catch(() => {});
  }
  async disconnect(keepWants = false) {
    const room = this.room;
    this.room = null;
    if (!keepWants) this.want = { mic: false, cam: false, screen: false };
    for (const el of this.elements.values()) el.remove();
    this.elements.clear();
    if (room) await room.disconnect().catch(() => {});
  }
}
