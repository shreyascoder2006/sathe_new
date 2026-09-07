"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  CAMPUS_BUILDINGS,
  CAMPUS_BOUNDS,
  CAMPUS_TREES,
  CAMPUS_LAMPS,
  CAMPUS_ENTRANCES,
  DEFAULT_CAMERA,
  buildingById,
} from "@/lib/geo/campus";
import { useCampus } from "@/lib/store";
import type { BuildingLive } from "./types";
import { buildingTone, overlayValue } from "./types";

const SKY = { day: "#1b2740", night: "#07080b", xray: "#05070d" } as const;

export function CampusScene({ live }: { live: BuildingLive[] }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<BuildingLive[]>(live);
  liveRef.current = live;

  useEffect(() => {
    const mount: HTMLDivElement | null = mountRef.current;
    if (!mount) return;
    const el: HTMLDivElement = mount;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 1, 3000);
    camera.position.set(...DEFAULT_CAMERA.position);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      useCampus.getState().setWebglFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    renderer.domElement.addEventListener(
      "webglcontextlost",
      (e) => {
        e.preventDefault();
        useCampus.getState().setWebglFailed(true);
      },
      { once: true },
    );

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 30;
    controls.maxDistance = 380;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.target.set(...DEFAULT_CAMERA.target);

    // ---- lights ----
    const hemi = new THREE.HemisphereLight(0xeef3ff, 0x1a1d24, 1);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff2df, 2.4);
    key.position.set(80, 130, 60);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -200;
    key.shadow.camera.right = 200;
    key.shadow.camera.top = 200;
    key.shadow.camera.bottom = -200;
    key.shadow.camera.far = 600;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x38bdf8, 0.6);
    rim.position.set(0, 30, 170);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0x818cf8, 0.5);
    fill.position.set(-60, 40, -80);
    scene.add(fill);

    // ---- ground + grid ----
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(CAMPUS_BOUNDS.width + 160, CAMPUS_BOUNDS.depth + 160),
      new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(
      CAMPUS_BOUNDS.width + 160,
      Math.round((CAMPUS_BOUNDS.width + 160) / 8),
      0x334155,
      0x1e293b,
    );
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.35;
    scene.add(grid);

    // ---- buildings ----
    interface BEntry {
      id: string;
      mesh: THREE.Mesh;
      mat: THREE.MeshStandardMaterial;
      edges: THREE.LineSegments;
      edgeMat: THREE.LineBasicMaterial;
      ring: THREE.Mesh;
      flow: THREE.Group;
      deco: THREE.Material[];
      height: number;
      isGround: boolean;
      baseY: number;
    }
    const entries: BEntry[] = [];
    const pickables: THREE.Object3D[] = [];

    for (const b of CAMPUS_BUILDINGS) {
      const isGround = b.id === "sports-ground";
      const h = Math.max(b.height, 0.4);
      const [w, d] = b.size;
      const fac = b.facade;
      const geo = new THREE.BoxGeometry(w, h, d);
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(isGround ? "#3fae5a" : fac.wall),
        roughness: isGround ? 1 : 0.85,
        metalness: 0.02,
        emissive: new THREE.Color(0x0b1220),
        emissiveIntensity: 0.05,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(b.position[0], h / 2, b.position[1]);
      mesh.rotation.y = b.rotation;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.buildingId = b.id;
      scene.add(mesh);
      pickables.push(mesh);

      const edgeMat = new THREE.LineBasicMaterial({ color: 0x34d399 });
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 15), edgeMat);
      mesh.add(edges);

      const deco: THREE.Material[] = [];
      const addChild = (
        cw: number,
        ch: number,
        cd: number,
        lx: number,
        ly: number,
        lz: number,
        color: string,
        opts: { rough?: number; metal?: number; emissive?: string } = {},
      ) => {
        const m = new THREE.MeshStandardMaterial({
          color: new THREE.Color(color),
          roughness: opts.rough ?? 0.9,
          metalness: opts.metal ?? 0,
          emissive: new THREE.Color(opts.emissive ?? "#000000"),
          emissiveIntensity: opts.emissive ? 1 : 0,
        });
        const cm = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, cd), m);
        cm.position.set(lx, ly, lz);
        cm.castShadow = true;
        cm.receiveShadow = true;
        mesh.add(cm);
        deco.push(m);
        return cm;
      };

      if (!isGround) {
        // ochre plinth / ground-floor band
        addChild(w + 0.5, 2.6, d + 0.5, 0, -h / 2 + 1.3, 0, fac.base, { rough: 0.95 });
        // flat-roof parapet lip
        addChild(w + 0.9, 0.7, d + 0.9, 0, h / 2 - 0.1, 0, fac.wall === "#e4d9bd" ? "#c7b995" : "#b9a884");
        // horizontal floor-line bands
        const floors = Math.max(1, b.floors);
        for (let f = 1; f < floors; f++) {
          addChild(w + 0.35, 0.35, d + 0.35, 0, -h / 2 + (h / floors) * f, 0, "#b7a988", { rough: 1 });
        }
        // open-corridor: recessed shadow strip + pillar rhythm on the open face
        if (fac.openCorridor && fac.openSide) {
          const along = fac.openSide === "north" || fac.openSide === "south" ? w : d;
          const face = along - 4;
          const sign = fac.openSide === "south" || fac.openSide === "east" ? 1 : -1;
          const onX = fac.openSide === "east" || fac.openSide === "west";
          const depth = 1.4;
          for (let f = 0; f < floors; f++) {
            const ly = -h / 2 + (h / floors) * (f + 0.5);
            // recessed dark corridor slot
            const slot = onX
              ? { cw: depth, cd: face }
              : { cw: face, cd: depth };
            addChild(
              slot.cw,
              (h / floors) * 0.62,
              slot.cd,
              onX ? sign * (w / 2 - depth / 2 + 0.1) : 0,
              ly,
              onX ? 0 : sign * (d / 2 - depth / 2 + 0.1),
              "#4b4436",
              { rough: 1 },
            );
          }
          // pillars
          const pillars = Math.min(14, Math.round(face / 6));
          for (let p = 0; p <= pillars; p++) {
            const t = pillars === 0 ? 0.5 : p / pillars;
            const off = (t - 0.5) * face;
            addChild(
              onX ? 1.1 : 1.1,
              h - 3,
              onX ? 1.1 : 1.1,
              onX ? sign * (w / 2 + 0.2) : off,
              0.5,
              onX ? off : sign * (d / 2 + 0.2),
              fac.wall === "#e4d9bd" ? "#d9cba6" : "#cdbf9c",
              { rough: 0.9 },
            );
          }
        }
        // pitched Mangalore-tile roof for the heritage block
        if (fac.pitchedRoof) {
          const roof = new THREE.Mesh(
            new THREE.ConeGeometry(Math.max(w, d) * 0.62, 5, 4),
            new THREE.MeshStandardMaterial({ color: new THREE.Color("#9c4a34"), roughness: 1 }),
          );
          roof.rotation.y = Math.PI / 4;
          roof.position.set(0, h / 2 + 2.4, 0);
          roof.castShadow = true;
          mesh.add(roof);
          deco.push(roof.material as THREE.Material);
        }
      } else {
        // turf ground: painted centre circle + halfway line + perimeter fence + goals
        const line = new THREE.MeshStandardMaterial({ color: new THREE.Color("#eaf3ec"), roughness: 1 });
        const circle = new THREE.Mesh(new THREE.RingGeometry(7.5, 8.4, 40), line);
        circle.rotation.x = -Math.PI / 2;
        circle.position.set(0, h / 2 + 0.02, 0);
        mesh.add(circle);
        const halfway = new THREE.Mesh(new THREE.PlaneGeometry(w - 4, 0.6), line);
        halfway.rotation.x = -Math.PI / 2;
        halfway.position.set(0, h / 2 + 0.02, 0);
        mesh.add(halfway);
        deco.push(line);
        // perimeter fence — thin posts, alternating red / blue caps
        const postGeo = new THREE.BoxGeometry(0.25, 3, 0.25);
        const redM = new THREE.MeshStandardMaterial({ color: new THREE.Color("#d64545"), roughness: 0.8 });
        const blueM = new THREE.MeshStandardMaterial({ color: new THREE.Color("#3b6fd4"), roughness: 0.8 });
        deco.push(redM, blueM);
        const perim: [number, number][] = [];
        const step = 5;
        for (let x = -w / 2; x <= w / 2; x += step) {
          perim.push([x, -d / 2], [x, d / 2]);
        }
        for (let z = -d / 2; z <= d / 2; z += step) {
          perim.push([-w / 2, z], [w / 2, z]);
        }
        perim.forEach(([x, z], i) => {
          const post = new THREE.Mesh(postGeo, i % 2 ? redM : blueM);
          post.position.set(x, h / 2 + 1.5, z);
          mesh.add(post);
        });
        // two goal frames
        const goalM = new THREE.MeshStandardMaterial({ color: new THREE.Color("#f5f5f5"), roughness: 0.6 });
        deco.push(goalM);
        [-1, 1].forEach((s) => {
          const g = new THREE.Group();
          const barGeo = new THREE.BoxGeometry(0.2, 0.2, 7);
          const postGeo2 = new THREE.BoxGeometry(0.2, 2.4, 0.2);
          const l = new THREE.Mesh(postGeo2, goalM);
          l.position.set(0, h / 2 + 1.2, -3.5);
          const r = new THREE.Mesh(postGeo2, goalM);
          r.position.set(0, h / 2 + 1.2, 3.5);
          const top = new THREE.Mesh(barGeo, goalM);
          top.position.set(0, h / 2 + 2.4, 0);
          g.add(l, r, top);
          g.position.set(s * (w / 2 - 3), 0, 0);
          mesh.add(g);
        });
      }

      // selection ground ring
      const ringR = Math.max(b.size[0], b.size[1]) * 0.62;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(ringR, ringR + 2.4, 48),
        new THREE.MeshBasicMaterial({
          color: 0x22d3ee,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(b.position[0], 0.08, b.position[1]);
      ring.visible = false;
      scene.add(ring);

      // energy-flow rings
      const flow = new THREE.Group();
      flow.position.set(b.position[0], 0, b.position[1]);
      flow.visible = false;
      for (let i = 0; i < 4; i++) {
        const fr = new THREE.Mesh(
          new THREE.RingGeometry(ringR * 0.8, ringR * 0.86, 40),
          new THREE.MeshBasicMaterial({
            color: 0x22d3ee,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide,
          }),
        );
        fr.rotation.x = -Math.PI / 2;
        flow.add(fr);
      }
      scene.add(flow);

      entries.push({
        id: b.id,
        mesh,
        mat,
        edges,
        edgeMat,
        ring,
        flow,
        deco,
        height: h,
        isGround,
        baseY: h / 2,
      });
    }

    // ---- props (instanced) ----
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.24, 2.2, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3f2d1d, roughness: 1 });
    const leafGeo = new THREE.IcosahedronGeometry(1.6, 0);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x1f6f43, roughness: 0.9, flatShading: true });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, CAMPUS_TREES.length);
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, CAMPUS_TREES.length);
    leaves.castShadow = true;
    const m4 = new THREE.Matrix4();
    CAMPUS_TREES.forEach(([x, z], i) => {
      m4.makeTranslation(x, 1.1, z);
      trunks.setMatrixAt(i, m4);
      m4.makeTranslation(x, 3.1, z);
      leaves.setMatrixAt(i, m4);
    });
    scene.add(trunks, leaves);

    const lampGeo = new THREE.SphereGeometry(0.28, 10, 10);
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: new THREE.Color(0x93c5fd),
      emissiveIntensity: 1.4,
    });
    CAMPUS_LAMPS.forEach(([x, z]) => {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 4, 6),
        new THREE.MeshStandardMaterial({ color: 0x2a3342, metalness: 0.6, roughness: 0.4 }),
      );
      post.position.set(x, 2, z);
      scene.add(post);
      const bulb = new THREE.Mesh(lampGeo, lampMat);
      bulb.position.set(x, 4.1, z);
      scene.add(bulb);
      const pl = new THREE.PointLight(0xbfdbfe, 10, 18);
      pl.position.set(x, 4, z);
      scene.add(pl);
    });

    // ---- entrance markers ----
    CAMPUS_ENTRANCES.forEach((e) => {
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(3, 24),
        new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.25 }),
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(e.position[0], 0.1, e.position[1]);
      scene.add(disc);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.4 }),
      );
      beam.position.set(e.position[0], 4, e.position[1]);
      scene.add(beam);
    });

    // ---- raycasting ----
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hoverId: string | null = null;
    let downPos: { x: number; y: number } | null = null;

    function setPointer(ev: PointerEvent) {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
      pointer.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    }
    function onMove(ev: PointerEvent) {
      setPointer(ev);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pickables, false)[0];
      const id = (hit?.object.userData.buildingId as string) ?? null;
      if (id !== hoverId) {
        hoverId = id;
        useCampus.getState().hover(id);
        renderer.domElement.style.cursor = id ? "pointer" : "grab";
      }
    }
    function onDown(ev: PointerEvent) {
      downPos = { x: ev.clientX, y: ev.clientY };
    }
    function onUp(ev: PointerEvent) {
      if (!downPos) return;
      const moved = Math.hypot(ev.clientX - downPos.x, ev.clientY - downPos.y);
      downPos = null;
      if (moved > 5) return; // drag, not a click
      setPointer(ev);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pickables, false)[0];
      const id = (hit?.object.userData.buildingId as string) ?? null;
      const cur = useCampus.getState().selectedBuildingId;
      useCampus.getState().select(id && id === cur ? null : id);
    }
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    // ---- resize ----
    function resize() {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    // ---- camera tween state ----
    const desiredPos = new THREE.Vector3(...DEFAULT_CAMERA.position);
    const desiredTarget = new THREE.Vector3(...DEFAULT_CAMERA.target);
    let tweening = true;
    let lastResetKey = useCampus.getState().cameraResetKey;
    let lastSelected: string | null = useCampus.getState().selectedBuildingId;
    let lastDaylight = useCampus.getState().daylight;

    function applyDaylight(d: "day" | "night" | "xray") {
      scene.background = new THREE.Color(SKY[d]);
      scene.fog = new THREE.Fog(SKY[d], 240, 620);
      key.intensity = d === "day" ? 2.8 : d === "xray" ? 0.9 : 2.1;
      hemi.intensity = d === "day" ? 1.1 : d === "xray" ? 0.5 : 1;
      entries.forEach((e) => {
        if (e.isGround) return;
        const xr = d === "xray";
        e.mat.transparent = xr;
        e.mat.opacity = xr ? 0.32 : 1;
        e.mat.needsUpdate = true;
        e.deco.forEach((m) => {
          const sm = m as THREE.MeshStandardMaterial;
          sm.transparent = xr;
          sm.opacity = xr ? 0.25 : 1;
          sm.needsUpdate = true;
        });
      });
    }
    applyDaylight(lastDaylight);

    function frameCameraFor(id: string | null) {
      const b = id ? buildingById(id) : null;
      if (b) {
        desiredPos.set(...b.view.position);
        desiredTarget.set(...b.view.target);
      } else {
        desiredPos.set(...DEFAULT_CAMERA.position);
        desiredTarget.set(...DEFAULT_CAMERA.target);
      }
      tweening = true;
    }

    // ---- animation loop ----
    const clock = new THREE.Clock();
    let raf = 0;
    function tick() {
      raf = requestAnimationFrame(tick);
      const t = clock.getElapsedTime();
      const st = useCampus.getState();

      if (st.cameraResetKey !== lastResetKey) {
        lastResetKey = st.cameraResetKey;
        frameCameraFor(st.selectedBuildingId);
      }
      if (st.selectedBuildingId !== lastSelected) {
        lastSelected = st.selectedBuildingId;
        frameCameraFor(st.selectedBuildingId);
      }
      if (st.daylight !== lastDaylight) {
        lastDaylight = st.daylight;
        applyDaylight(st.daylight);
      }

      if (tweening) {
        camera.position.lerp(desiredPos, 0.08);
        controls.target.lerp(desiredTarget, 0.08);
        if (
          camera.position.distanceTo(desiredPos) < 0.6 &&
          controls.target.distanceTo(desiredTarget) < 0.6
        ) {
          tweening = false;
        }
      }

      const arr = liveRef.current;
      const byId: Record<string, BuildingLive> = {};
      for (const b of arr) byId[b.id] = b;

      for (const e of entries) {
        const lb = byId[e.id];
        const sel = st.selectedBuildingId === e.id;
        const hov = st.hoveredBuildingId === e.id;
        const ov = lb ? overlayValue(lb, st.overlay) : null;

        // lift on select
        const targetY = e.baseY + (sel && !e.isGround ? 1.2 : 0);
        e.mesh.position.y += (targetY - e.mesh.position.y) * 0.12;

        // emissive — cream plaster shows through; only tint on state
        let emColor = 0x0b1220;
        let emInt = e.isGround ? 0 : 0.04;
        if (sel) {
          emColor = 0x22d3ee;
          emInt = 0.4 + Math.sin(t * 3) * 0.15;
        } else if (ov && ov.intensity > 0.05) {
          emColor = new THREE.Color(ov.color).getHex();
          emInt = 0.12 + ov.intensity * 0.6;
        } else if (hov) {
          emColor = 0x3b82f6;
          emInt = 0.3;
        }
        e.mat.emissive.setHex(emColor);
        e.mat.emissiveIntensity = emInt;

        // edge colour
        const tone = lb ? buildingTone(lb) : "#64748b";
        e.edgeMat.color.set(sel ? "#7dd3fc" : hov ? "#93c5fd" : tone);

        // rings
        e.ring.visible = sel;
        if (sel) {
          (e.ring.material as THREE.MeshBasicMaterial).opacity =
            0.4 + Math.sin(t * 3) * 0.2;
        }
        e.flow.visible = sel && !e.isGround;
        if (e.flow.visible) {
          e.flow.children.forEach((c, i) => {
            const p = (t * 0.5 + i / 4) % 1;
            c.position.y = p * e.height;
            const s = 0.9 + Math.sin(p * Math.PI) * 0.15;
            c.scale.setScalar(s);
            (c as THREE.Mesh).visible = true;
            ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity =
              Math.sin(p * Math.PI) * 0.6;
          });
        }
      }

      controls.update();
      renderer.render(scene, camera);
    }
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      renderer.dispose();
      scene.traverse((o) => {
        const anyO = o as THREE.Mesh;
        if (anyO.geometry) anyO.geometry.dispose();
        const mm = anyO.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mm)) mm.forEach((x) => x.dispose());
        else if (mm) mm.dispose();
      });
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} className="h-full w-full" style={{ cursor: "grab" }} />;
}
