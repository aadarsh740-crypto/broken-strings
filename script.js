// ===== Broken Strings — interactions =====
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  $("#year").textContent = new Date().getFullYear();

  /* ---------- Nav: scrolled state, burger, active link ---------- */
  const nav = $("#nav");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 40);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const burger = $("#burger");
  const links = $("#navLinks");
  const setMenu = (open) => {
    burger.classList.toggle("open", open);
    links.classList.toggle("open", open);
    nav.classList.toggle("menu-open", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.documentElement.style.overflow = open ? "hidden" : "";
    document.body.style.overflow = open ? "hidden" : "";
  };
  burger.addEventListener("click", () => setMenu(!links.classList.contains("open")));
  $$("a", links).forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });
  window.matchMedia("(min-width: 1101px)").addEventListener("change", (e) => { if (e.matches) setMenu(false); });

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        $$("a", links).forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#${e.target.id}`));
      });
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );
  $$("main section[id]").forEach((s) => sectionObserver.observe(s));

  /* ---------- Reveal on scroll + counters ---------- */
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        $$("[data-auto]", e.target).forEach(countUp);
        revealObserver.unobserve(e.target);
      });
    },
    { threshold: 0.15 }
  );
  $$(".reveal").forEach((el, i) => {
    el.style.transitionDelay = `${(i % 4) * 90}ms`;
    revealObserver.observe(el);
  });

  // Real numbers for the About stats, worked out from the page itself.
  const FORMED_YEAR = 2017;
  function statValue(key) {
    if (key === "years") return Math.max(0, new Date().getFullYear() - FORMED_YEAR);
    if (key === "tracks") return $$(".tracklist li[data-src]").length;
    if (key === "sessions") return SESSIONS.filter((s) => s.video).length;
    return 0;
  }

  function countUp(el) {
    const target = statValue(el.dataset.auto);
    const start = performance.now();
    const dur = 1400;
    const tick = (t) => {
      const p = Math.min((t - start) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- Audio: Karplus-Strong plucked string ---------- */
  let ctx;
  const audio = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());

  function pluck(freq, when = 0, gain = 0.35, duration = 1.8) {
    const ac = audio();
    const sr = ac.sampleRate;
    const len = Math.floor(sr * duration);
    const buf = ac.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    const period = Math.round(sr / freq);
    const ring = new Float32Array(period).map(() => Math.random() * 2 - 1);
    for (let i = 0, j = 0; i < len; i++) {
      const next = (j + 1) % period;
      const v = (ring[j] + ring[next]) * 0.4985;
      data[i] = ring[j];
      ring[j] = v;
      j = next;
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    // light overdrive for a rock edge
    const shaper = ac.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = (i / 128) - 1; curve[i] = Math.tanh(x * 2.2); }
    shaper.curve = curve;
    const g = ac.createGain();
    g.gain.value = gain;
    src.connect(shaper).connect(g).connect(ac.destination);
    src.start(ac.currentTime + when);
  }

  const strings = $$("#strings .string");
  let lastHover = null;
  const strike = (s) => {
    s.classList.remove("pluck");
    void s.offsetWidth;
    s.classList.add("pluck");
    try { pluck(+s.dataset.note); } catch (_) { /* audio unavailable */ }
  };
  strings.forEach((s) => {
    s.addEventListener("mouseenter", () => { if (lastHover !== s) strike(s); lastHover = s; });
    s.addEventListener("click", () => strike(s));
  });
  $("#strings").addEventListener("mouseleave", () => (lastHover = null));
  $("#strings").addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    const el = document.elementFromPoint(t.clientX, t.clientY);
    if (el && el.classList.contains("string") && el !== lastHover) { strike(el); lastHover = el; }
  }, { passive: true });

  /* ---------- "Now playing" pop-up ---------- */
  const np = $("#nowPlaying");
  const npText = $("#npText");

  /* ---------- Our Tracks: real audio ---------- */
  const audioEl = new Audio();
  audioEl.preload = "none";
  const trackRows = $$(".tracklist li[data-src]");
  let trackRow = null; // row whose file is loaded in audioEl
  const fmt = (s) => (isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");

  function pauseTrack() { if (!audioEl.paused) audioEl.pause(); }
  function pauseSessionVideo() { const v = $("#player video"); if (v && !v.paused) v.pause(); }

  function paintTracks() {
    trackRows.forEach((li) => {
      const isCurrent = li === trackRow;
      const playing = isCurrent && !audioEl.paused;
      li.classList.toggle("playing", playing);
      li.classList.toggle("loaded", isCurrent);
      const btn = $(".mini-play", li);
      btn.textContent = playing ? "❚❚" : "▶";
      btn.setAttribute("aria-label", `${playing ? "Pause" : "Play"} ${$(".t", li).textContent}`);
      if (!isCurrent) { $(".d", li).textContent = $(".d", li).dataset.total; li.style.setProperty("--p", 0); }
    });
  }

  function toggleTrack(li) {
    if (trackRow === li) {
      if (audioEl.paused) audioEl.play().catch(() => {}); else audioEl.pause();
      return;
    }
    trackRow = li;
    audioEl.src = li.dataset.src;
    audioEl.play().catch(() => {});
    paintTracks();
  }

  audioEl.addEventListener("play", () => {
    pauseSessionVideo();
    npText.textContent = `Now playing — ${$(".t", trackRow).textContent}`;
    np.classList.add("show");
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: $(".t", trackRow).textContent, artist: "Broken Strings" });
    }
    paintTracks();
  });
  audioEl.addEventListener("pause", () => { np.classList.remove("show"); paintTracks(); });
  audioEl.addEventListener("timeupdate", () => {
    if (!trackRow) return;
    const p = audioEl.duration ? audioEl.currentTime / audioEl.duration : 0;
    trackRow.style.setProperty("--p", p);
    $(".d", trackRow).textContent = fmt(audioEl.currentTime);
  });
  audioEl.addEventListener("ended", () => {
    const next = trackRows[trackRows.indexOf(trackRow) + 1];
    if (next) toggleTrack(next);
    else { trackRow = null; paintTracks(); np.classList.remove("show"); }
  });

  trackRows.forEach((li) => {
    // Tap anywhere on the row to play/pause, except on the progress bar (that seeks).
    li.addEventListener("click", (e) => { if (!e.target.closest(".bar")) toggleTrack(li); });
    $(".bar", li).addEventListener("click", (e) => {
      if (trackRow !== li) { toggleTrack(li); return; }
      const r = e.currentTarget.getBoundingClientRect();
      if (audioEl.duration) audioEl.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * audioEl.duration;
    });
  });

  /* ---------- Our Sessions (videos) ----------
     To add a video, fill in `video` with EITHER:
       • a YouTube link  — e.g. "https://www.youtube.com/watch?v=XXXXXXXXXXX" or "https://youtu.be/XXXXXXXXXXX"
       • a video file in the videos/ folder — e.g. "videos/garage-session.mp4"
     `poster` (optional) is a cover image for video files, e.g. "videos/garage-session.jpg".
     YouTube videos get their cover image automatically.
     `focus` (optional) picks which part of the cover shows in the small card, e.g. "center 70%" to favour the lower part.
     `icon` picks the placeholder drawing: mic, guitar, drum or keys.
     Entries with an empty `video` show as "Coming soon". */
  const SESSIONS = [
    { title: "Ishq Mubarak ft. ADR", info: "Live session", video: "videos/ishq-mubarak.mp4", poster: "videos/ishq-mubarak.jpg", focus: "center", icon: "guitar" },
    { title: "Sundariye Vaa ft. tm_shapp", info: "Live session", video: "videos/sundariye-vaa.mp4", poster: "videos/sundariye-vaa.jpg", focus: "center 72%", icon: "mic" },
  ];

  const youTubeId = (url) => {
    const m = String(url).match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
    return m ? m[1] : null;
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const coverFor = (s) => {
    const id = youTubeId(s.video);
    if (id) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    return s.poster || "";
  };
  // Blurred copy of the cover behind the player, so tall or very wide videos don't sit between plain black bars.
  const backdrop = (src) => `<img class="player-backdrop" src="${esc(src)}" alt="" aria-hidden="true">`;
  const placeholder = (s, label) =>
    `<div class="ph-art"><svg><use href="#i-${esc(s.icon || "guitar")}"/></svg><span class="ph-label">${label}</span></div>`;

  const player = $("#player");
  const grid = $("#sessionGrid");
  let currentSession = 0;

  function showInPlayer(i, autoplay) {
    const s = SESSIONS[i];
    currentSession = i;
    $("#playerTitle").textContent = s.title;
    $("#playerInfo").textContent = s.info || "";
    $("#playerCount").textContent = `${String(i + 1).padStart(2, "0")} / ${String(SESSIONS.length).padStart(2, "0")}`;
    $$(".session-card", grid).forEach((c, j) => c.classList.toggle("active", j === i));

    if (!s.video) { player.innerHTML = placeholder(s, "SESSION COMING SOON"); return; }

    const id = youTubeId(s.video);
    if (!autoplay) {
      const cover = coverFor(s);
      player.innerHTML = `<button class="player-poster" aria-label="Play ${esc(s.title)}">
          ${cover ? `${backdrop(cover)}<img class="fit" src="${esc(cover)}" alt="">` : placeholder(s, "PRESS PLAY")}
          <span class="big-play">▶</span></button>`;
      $(".player-poster", player).addEventListener("click", () => showInPlayer(i, true));
      return;
    }
    // Pause any song that is playing
    np.classList.remove("show");
    pauseTrack();
    if (id) {
      player.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1"
        title="${esc(s.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    } else {
      player.innerHTML = `${s.poster ? backdrop(s.poster) : ""}<video src="${esc(s.video)}" ${s.poster ? `poster="${esc(s.poster)}"` : ""} controls autoplay playsinline preload="metadata"></video>`;
      $("video", player).addEventListener("play", pauseTrack);
    }
  }

  grid.innerHTML = SESSIONS.map((s, i) => {
    const cover = coverFor(s);
    return `<button class="session-card reveal" data-i="${i}" aria-label="${esc(s.title)}">
        <div class="thumb">
          ${s.video ? (cover ? `<img src="${esc(cover)}" alt="" loading="lazy" style="object-position:${esc(s.focus || "center")}">` : placeholder(s, "PLAY")) : placeholder(s, "COMING SOON")}
          ${s.video ? `<span class="mini">▶</span>` : ""}
        </div>
        <h4>${esc(s.title)}</h4>
        <p>${esc(s.info || "")}</p>
      </button>`;
  }).join("");
  $$(".session-card", grid).forEach((card) => {
    revealObserver.observe(card);
    card.addEventListener("click", () => {
      const i = +card.dataset.i;
      showInPlayer(i, !!SESSIONS[i].video);
      // Bring the player into view (just below the fixed nav bar) if it's off-screen.
      const top = player.getBoundingClientRect().top;
      const navH = nav.offsetHeight + 16;
      if (top < navH || top > window.innerHeight * 0.5) {
        window.scrollTo({ top: top + window.scrollY - navH, behavior: "smooth" });
      }
    });
  });
  showInPlayer(0, false);

  // Fill the About stats right away too, in case the count-up animation never runs.
  $$("[data-auto]").forEach((el) => { el.textContent = statValue(el.dataset.auto); });

  /* ---------- Contact form ---------- */
  const form = $("#contactForm");
  const status = $("#formStatus");
  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let ok = true;
    $$(".field", form).forEach((f) => {
      const input = $("input, textarea, select", f);
      const valid = input.type === "email" ? emailOk(input.value.trim()) : input.value.trim() !== "";
      f.classList.toggle("error", !valid);
      if (!valid) ok = false;
    });
    if (!ok) {
      status.className = "form-status bad";
      status.textContent = "Some strings are loose — please fill in every field correctly.";
      return;
    }
    const btn = $("button[type=submit]", form);
    btn.disabled = true;
    btn.textContent = "Tuning up…";
    // No backend yet: simulate a send. Hook this up to your API / Formspree / etc.
    setTimeout(() => {
      const name = $("#name").value.trim().split(" ")[0];
      status.className = "form-status ok";
      status.textContent = `🤘 Thanks ${name}! Your message hit the stage — we'll get back to you soon.`;
      form.reset();
      btn.disabled = false;
      btn.textContent = "Send it loud →";
      try { [329.63, 392, 493.88].forEach((f, i) => pluck(f, i * 0.12, 0.25, 1.2)); } catch (_) {}
    }, 900);
  });
  $$(".field input, .field textarea, .field select", form).forEach((el) =>
    el.addEventListener("input", () => el.closest(".field").classList.remove("error"))
  );
})();
