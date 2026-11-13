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
        $$("[data-count]", e.target).forEach(countUp);
        revealObserver.unobserve(e.target);
      });
    },
    { threshold: 0.15 }
  );
  $$(".reveal").forEach((el, i) => {
    el.style.transitionDelay = `${(i % 4) * 90}ms`;
    revealObserver.observe(el);
  });

  function countUp(el) {
    const target = +el.dataset.count;
    const start = performance.now();
    const dur = 1600;
    const tick = (t) => {
      const p = Math.min((t - start) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = target + (target >= 100 ? "+" : "");
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

  /* ---------- Fake "play" for albums & tracks (short riff + toast) ---------- */
  const riffs = [
    [82.41, 110, 146.83, 110, 82.41, 98, 110, 123.47],
    [110, 130.81, 146.83, 164.81, 146.83, 130.81, 110, 98],
    [146.83, 196, 220, 196, 164.81, 146.83, 130.81, 146.83],
  ];
  const np = $("#nowPlaying");
  const npText = $("#npText");
  let npTimer;
  let current = null;

  function stopAll() {
    $$(".album.playing, .tracklist li.playing").forEach((el) => {
      el.classList.remove("playing");
      const b = $(".play, .mini-play", el);
      if (b) b.textContent = "▶";
    });
  }

  function play(el, title, riffIndex) {
    if (current === el) { stopAll(); current = null; np.classList.remove("show"); return; }
    stopAll();
    current = el;
    el.classList.add("playing");
    const b = $(".play, .mini-play", el);
    if (b) b.textContent = "❚❚";
    npText.textContent = `Now playing — ${title}`;
    np.classList.add("show");
    try { riffs[riffIndex % riffs.length].forEach((f, i) => pluck(f, i * 0.22, 0.28, 1.2)); } catch (_) {}
    clearTimeout(npTimer);
    npTimer = setTimeout(() => { stopAll(); current = null; np.classList.remove("show"); }, 4500);
  }

  $$(".album").forEach((album, i) => {
    album.addEventListener("click", () => play(album, $("h3", album).textContent, i));
  });
  $$(".tracklist li").forEach((li, i) => {
    $(".mini-play", li).addEventListener("click", () => play(li, $(".t", li).textContent, i));
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
    // Stop any riff / now-playing toast from the albums
    stopAll(); current = null; np.classList.remove("show");
    if (id) {
      player.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1"
        title="${esc(s.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    } else {
      player.innerHTML = `${s.poster ? backdrop(s.poster) : ""}<video src="${esc(s.video)}" ${s.poster ? `poster="${esc(s.poster)}"` : ""} controls autoplay playsinline preload="metadata"></video>`;
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
