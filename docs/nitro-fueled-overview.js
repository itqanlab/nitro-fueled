"use strict";

(() => {
  const canvas = document.getElementById("hero-network");
  const hero = document.querySelector(".hero");
  if (!canvas || !hero) return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = canvas.getContext("2d", { alpha: true });

  // Nitro hero visual system: directional fluid streaks + glow fields + pointer pressure ripples.
  const NITRO = {
    maxDpr: 2,
    streamDensity: 7600,
    minStreams: 90,
    maxStreams: 260,
    baseSpeed: 1.05,
    drag: 0.982,
    trailFade: 0.14,
    edgePadding: 50,
    pointerRadius: 180,
    pointerTwist: 0.09,
    pointerPush: 0.028,
    rippleLife: 650,
    rippleGapMs: 120,
    turbulence: 0.72,
  };

  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    time: 0,
    streams: [],
    ripples: [],
    pointer: { x: 0, y: 0, active: false, lastRippleAt: 0 },
  };

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function makeStream() {
    const layer = Math.random();
    const warmBias = Math.random() < 0.72;

    return {
      x: rand(-state.width * 0.2, state.width),
      y: rand(-state.height * 0.05, state.height * 1.05),
      px: 0,
      py: 0,
      vx: rand(0.5, 1.2) * NITRO.baseSpeed,
      vy: rand(-0.3, 0.3),
      width: layer < 0.45 ? rand(0.7, 1.3) : rand(1.1, 2.2),
      energy: rand(0.4, 1),
      noise: rand(0, Math.PI * 2),
      life: rand(140, 460),
      maxLife: rand(300, 760),
      warmBias,
      layer,
    };
  }

  function resetStream(stream, fromLeft = true) {
    stream.x = fromLeft ? rand(-state.width * 0.18, -16) : rand(state.width + 12, state.width * 1.16);
    stream.y = rand(-state.height * 0.08, state.height * 1.08);
    stream.px = stream.x;
    stream.py = stream.y;
    stream.vx = (fromLeft ? 1 : -1) * rand(0.6, 1.4) * NITRO.baseSpeed;
    stream.vy = rand(-0.25, 0.25);
    stream.width = stream.layer < 0.45 ? rand(0.7, 1.3) : rand(1.1, 2.2);
    stream.energy = rand(0.4, 1);
    stream.noise = rand(0, Math.PI * 2);
    stream.life = 0;
    stream.maxLife = rand(300, 760);
  }

  function resizeHeroCanvas() {
    const rect = hero.getBoundingClientRect();
    state.width = Math.max(1, Math.floor(rect.width));
    state.height = Math.max(1, Math.floor(rect.height));
    state.dpr = Math.min(window.devicePixelRatio || 1, NITRO.maxDpr);

    canvas.width = Math.floor(state.width * state.dpr);
    canvas.height = Math.floor(state.height * state.dpr);
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;

    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

    const targetCount = clamp(
      Math.floor((state.width * state.height) / NITRO.streamDensity),
      NITRO.minStreams,
      NITRO.maxStreams
    );

    if (state.streams.length < targetCount) {
      while (state.streams.length < targetCount) state.streams.push(makeStream());
    } else if (state.streams.length > targetCount) {
      state.streams.length = targetCount;
    }

    state.streams.forEach((stream) => {
      stream.px = stream.x;
      stream.py = stream.y;
    });
  }

  function updateRipples(now) {
    state.ripples = state.ripples.filter((ripple) => now - ripple.start < NITRO.rippleLife);
  }

  function maybeEmitRipple(now) {
    if (!state.pointer.active) return;
    if (now - state.pointer.lastRippleAt < NITRO.rippleGapMs) return;

    state.pointer.lastRippleAt = now;
    state.ripples.push({
      x: state.pointer.x,
      y: state.pointer.y,
      start: now,
      radius: rand(30, 56),
    });
  }

  function sampleFlow(stream, now) {
    const nx = stream.x / Math.max(1, state.width);
    const ny = stream.y / Math.max(1, state.height);
    const t = now * 0.00018;

    // Directional "nitro" drift with layered curved pressure bands.
    const axial = 1.32 + Math.sin((ny * 7.8) + t * 6.2 + stream.noise) * 0.3;
    const shear = Math.cos((nx * 6.2) - t * 5.1 + stream.noise * 0.7) * 0.9;
    const warp = Math.sin((ny * 3.6) + (nx * 3.2) + t * 4.6) * 0.5;

    let fx = axial;
    let fy = shear * 0.34 + warp * 0.42;

    // Pointer introduces local pressure/turbulence instead of obvious attraction aura.
    if (state.pointer.active) {
      const dx = state.pointer.x - stream.x;
      const dy = state.pointer.y - stream.y;
      const distSq = dx * dx + dy * dy;
      const maxSq = NITRO.pointerRadius * NITRO.pointerRadius;

      if (distSq > 0.001 && distSq < maxSq) {
        const dist = Math.sqrt(distSq);
        const influence = 1 - dist / NITRO.pointerRadius;
        const nxp = dx / dist;
        const nyp = dy / dist;

        // Tangential twist + subtle push = pressure-wave feel.
        fx += (-nyp) * NITRO.pointerTwist * influence;
        fy += nxp * NITRO.pointerTwist * influence;

        fx -= nxp * NITRO.pointerPush * influence;
        fy -= nyp * NITRO.pointerPush * influence;
      }
    }

    return { fx, fy };
  }

  function updateStream(stream, dt, now) {
    stream.px = stream.x;
    stream.py = stream.y;

    const { fx, fy } = sampleFlow(stream, now);
    const layerBoost = 0.64 + stream.layer * 0.95;

    stream.vx += fx * NITRO.turbulence * layerBoost * dt;
    stream.vy += fy * NITRO.turbulence * layerBoost * dt;

    stream.vx *= NITRO.drag;
    stream.vy *= NITRO.drag;

    stream.x += stream.vx * dt * 1.08;
    stream.y += stream.vy * dt * 1.08;

    stream.life += dt;

    const outOfBounds =
      stream.x < -NITRO.edgePadding ||
      stream.x > state.width + NITRO.edgePadding ||
      stream.y < -NITRO.edgePadding ||
      stream.y > state.height + NITRO.edgePadding;

    if (outOfBounds || stream.life > stream.maxLife) {
      resetStream(stream, Math.random() > 0.22);
    }
  }

  function paintHeroBackdrop() {
    ctx.fillStyle = `rgba(8, 12, 22, ${NITRO.trailFade})`;
    ctx.fillRect(0, 0, state.width, state.height);

    const warmCore = ctx.createRadialGradient(
      state.width * 0.5,
      state.height * 0.34,
      0,
      state.width * 0.5,
      state.height * 0.34,
      state.width * 0.54
    );
    warmCore.addColorStop(0, "rgba(249, 115, 22, 0.14)");
    warmCore.addColorStop(0.45, "rgba(249, 115, 22, 0.06)");
    warmCore.addColorStop(1, "rgba(249, 115, 22, 0)");
    ctx.fillStyle = warmCore;
    ctx.fillRect(0, 0, state.width, state.height);

    const coolSweep = ctx.createLinearGradient(0, state.height * 0.22, state.width, state.height * 0.72);
    coolSweep.addColorStop(0, "rgba(25, 130, 255, 0.02)");
    coolSweep.addColorStop(0.5, "rgba(25, 130, 255, 0.08)");
    coolSweep.addColorStop(1, "rgba(25, 130, 255, 0.01)");
    ctx.fillStyle = coolSweep;
    ctx.fillRect(0, 0, state.width, state.height);
  }

  function drawRipples(now) {
    if (!state.ripples.length) return;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    state.ripples.forEach((ripple) => {
      const age = now - ripple.start;
      const t = age / NITRO.rippleLife;
      const radius = ripple.radius + t * 120;
      const alpha = (1 - t) * 0.2;

      ctx.strokeStyle = `rgba(255, 165, 94, ${alpha.toFixed(3)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    });

    ctx.restore();
  }

  function drawStreams(now) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const stream of state.streams) {
      const dx = stream.x - stream.px;
      const dy = stream.y - stream.py;
      const segLen = Math.hypot(dx, dy);
      if (segLen < 0.01) continue;

      const lifeFade = Math.min(1, stream.life / 80) * (1 - Math.max(0, (stream.life - stream.maxLife * 0.82) / (stream.maxLife * 0.18)));
      const speedGlow = clamp(segLen * 0.5, 0.15, 1);
      const intensity = lifeFade * stream.energy * speedGlow;

      const warm = stream.warmBias;
      const stroke = warm
        ? `rgba(255, ${Math.floor(130 + intensity * 70)}, ${Math.floor(70 + intensity * 36)}, ${(0.2 + intensity * 0.48).toFixed(3)})`
        : `rgba(${Math.floor(92 + intensity * 24)}, ${Math.floor(182 + intensity * 35)}, 255, ${(0.12 + intensity * 0.34).toFixed(3)})`;

      ctx.strokeStyle = stroke;
      ctx.lineWidth = stream.width * (0.72 + intensity * 1.5);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(stream.px, stream.py);
      ctx.lineTo(stream.x, stream.y);
      ctx.stroke();

      if (stream.layer > 0.64 && intensity > 0.35) {
        const headGlow = ctx.createRadialGradient(stream.x, stream.y, 0, stream.x, stream.y, stream.width * 13);
        if (warm) {
          headGlow.addColorStop(0, `rgba(255, 180, 110, ${(0.2 * intensity).toFixed(3)})`);
          headGlow.addColorStop(1, "rgba(255, 180, 110, 0)");
        } else {
          headGlow.addColorStop(0, `rgba(126, 212, 255, ${(0.16 * intensity).toFixed(3)})`);
          headGlow.addColorStop(1, "rgba(126, 212, 255, 0)");
        }
        ctx.fillStyle = headGlow;
        ctx.beginPath();
        ctx.arc(stream.x, stream.y, stream.width * 13, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    const highlight = 0.57 + Math.sin(now * 0.0011) * 0.08;
    ctx.fillStyle = `rgba(255, 190, 130, ${highlight * 0.045})`;
    ctx.fillRect(0, 0, state.width, state.height);
  }

  let lastFrame = performance.now();
  function animate(now) {
    const dt = Math.min(32, now - lastFrame) * 0.06;
    lastFrame = now;
    state.time = now;

    paintHeroBackdrop();
    updateRipples(now);
    maybeEmitRipple(now);

    for (const stream of state.streams) updateStream(stream, dt, now);

    drawStreams(now);
    drawRipples(now);

    requestAnimationFrame(animate);
  }

  function setPointer(clientX, clientY) {
    const rect = hero.getBoundingClientRect();
    state.pointer.x = clientX - rect.left;
    state.pointer.y = clientY - rect.top;
    state.pointer.active =
      state.pointer.x >= 0 &&
      state.pointer.x <= rect.width &&
      state.pointer.y >= 0 &&
      state.pointer.y <= rect.height;
  }

  window.addEventListener("resize", resizeHeroCanvas);
  hero.addEventListener("mousemove", (event) => setPointer(event.clientX, event.clientY));
  hero.addEventListener("mouseleave", () => { state.pointer.active = false; });
  hero.addEventListener("touchmove", (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    setPointer(touch.clientX, touch.clientY);
  }, { passive: true });
  hero.addEventListener("touchend", () => { state.pointer.active = false; });

  resizeHeroCanvas();

  // Keep a static premium frame when reduced motion is enabled.
  if (prefersReducedMotion) {
    paintHeroBackdrop();
    drawStreams(performance.now());
    return;
  }

  requestAnimationFrame(animate);
})();

(() => {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion || !window.gsap || !window.ScrollTrigger) return;

  gsap.registerPlugin(ScrollTrigger);

  const revealGroups = [
    {
      scope: ".hero",
      items: [".hero-badge", "h1", ".hero-lead", ".hero-summary", ".hero-flow", ".hero-stats"],
    },
    {
      scope: "section",
      items: [
        ".section-label", ".section-title", ".section-desc",
        ".reader-path", ".arch-container", ".flow-container", ".ww-diagram", ".state-machine",
        ".worker-cards", ".supervisor-flow", ".decision-diagram", ".legend", ".agent-grid",
        ".skills-grid", ".cmd-grid"
      ],
    },
    {
      scope: "footer",
      items: ["p"],
    }
  ];

  revealGroups.forEach((group) => {
    document.querySelectorAll(group.scope).forEach((container) => {
      const elements = [];
      group.items.forEach((selector) => {
        container.querySelectorAll(selector).forEach((el) => {
          if (!elements.includes(el)) elements.push(el);
        });
      });

      if (!elements.length) return;

      gsap.set(elements, { autoAlpha: 0, y: 24, filter: "blur(3px)" });

      gsap.timeline({
        scrollTrigger: {
          trigger: container,
          start: "top 78%",
          once: true
        }
      }).to(elements, {
        autoAlpha: 1,
        y: 0,
        filter: "blur(0px)",
        duration: 0.68,
        stagger: 0.06,
        ease: "power3.out"
      });
    });
  });

  gsap.to(".state-connector, .ww-arrow, .hero-flow .arrow", {
    x: 1.5,
    duration: 1.8,
    yoyo: true,
    repeat: -1,
    ease: "sine.inOut",
    stagger: 0.04
  });

  gsap.to(".hero-stat .num", {
    y: -1.5,
    opacity: 1,
    duration: 2.1,
    yoyo: true,
    repeat: -1,
    ease: "sine.inOut",
    stagger: 0.08
  });
})();
