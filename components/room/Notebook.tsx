"use client";

import { useEffect, useMemo, useRef } from "react";

import { useFrame, useThree } from "@react-three/fiber";
import {
  CanvasTexture,
  SRGBColorSpace,
  Vector3,
  type Group,
  type MeshStandardMaterial,
} from "three";

import {
  getJournalLevel,
  JOURNAL_GLOW,
  JOURNAL_PLACEHOLDER,
} from "@/three/interface/journal";

import {
  requestInteraction,
  type AcceptancePolicy,
} from "@/three/animation/acceptance";
import type { AttentionTarget } from "@/three/animation/attention";
import { NEUTRAL_DIR } from "@/three/animation/firstLook";
import { WORKING_EYE } from "@/three/animation/firstStep";
import {
  beginCommit,
  hasIntent,
  releaseCommit,
} from "@/three/animation/intent";
import {
  carryPoint,
  gazeGoal,
  GRIP_ASIDE_SHIFT,
  GRIP_DIP,
  GRIP_ROLL,
  GRIP_TILT_EASE,
  GRIP_TOTAL,
  gripProgress,
  HELD_ASIDE,
  OPEN_ANGLE,
  OPEN_COUNTER_ROLL,
  OPEN_SETTLE_DIP,
  OPEN_TOTAL,
  openProgress,
  SEE_TOTAL,
  seeProgress,
  HELD_BELOW_EYE,
  HELD_FORWARD,
  HELD_REGARD_PITCH,
  HELD_TILT,
  HELD_YAW_SKEW,
  ORIENT_ASIDE,
  ORIENT_BELOW_EYE,
  ORIENT_TILT,
  ORIENT_YAW_SKEW,
  pickupPose,
  pursueGaze,
} from "@/three/animation/pickup";
import type { RoomBehavior } from "@/three/animation/presence";
import { conditions, type ReadinessRule } from "@/three/animation/readiness";
import { visitorState } from "@/three/animation/visitorState";
import { useAcceptancePolicy } from "@/three/hooks/useAcceptancePolicy";
import { useAttentionTarget } from "@/three/hooks/useAttentionTarget";
import { useReadinessRule } from "@/three/hooks/useReadinessRule";
import { useRoomBehavior } from "@/three/hooks/useRoomBehavior";
import { NOTEBOOK, WORKBENCH } from "@/three/scene/constants";
import { fromWorkbench } from "@/three/scene/world";

const REST_POSITION = fromWorkbench([
  NOTEBOOK.offset[0],
  WORKBENCH.surfaceHeight + NOTEBOOK.thickness / 2,
  NOTEBOOK.offset[2],
]);

/**
 * The notebook's attention center follows the notebook: on the bench
 * until it is picked up, then in the hands (WORK ORDER 0032 — the
 * dormant note from 0031, fixed the moment it became meaningful).
 */
const ATTENTION_POSITION: [number, number, number] = [...REST_POSITION];

/** The first meaningful object the room can notice being observed. */
const ATTENTION_TARGET: AttentionTarget = {
  name: "notebook",
  position: ATTENTION_POSITION,
  /** Half-diagonal of the closed notebook. */
  radius: 0.13,
};

/**
 * When engaging the notebook would be appropriate (WORK ORDER 0024):
 * standing at the bench, no longer moving, genuinely observing it.
 */
const READINESS_RULE: ReadinessRule = {
  target: "notebook",
  conditions: [
    conditions.atPosition("working"),
    conditions.still(),
    conditions.observed("notebook"),
  ],
};

/**
 * The room's answer for the notebook (WORK ORDER 0026). It currently has
 * no reason to refuse; future context — an impossible moment in progress,
 * the room's own timing — joins here without touching the pipeline.
 */
const ACCEPTANCE_POLICY: AcceptancePolicy = {
  target: "notebook",
  accepts: () => true,
};

/**
 * Where a standing person holds a closed notebook (WORK ORDERS 0027,
 * 0028): low in both hands, biased toward the dominant hand.
 */
const HELD_POSITION: [number, number, number] = [
  WORKING_EYE[0] +
    Math.sin(NEUTRAL_DIR.yaw) * HELD_FORWARD +
    Math.cos(NEUTRAL_DIR.yaw) * HELD_ASIDE,
  WORKING_EYE[1] - HELD_BELOW_EYE,
  WORKING_EYE[2] -
    Math.cos(NEUTRAL_DIR.yaw) * HELD_FORWARD +
    Math.sin(NEUTRAL_DIR.yaw) * HELD_ASIDE,
];

/** The hold's casual final orientation: a few degrees off square. */
const HELD_YAW = NEUTRAL_DIR.yaw + HELD_YAW_SKEW;

/**
 * Where the one unconscious adjustment leaves the notebook (WORK ORDER
 * 0029): nearly square, tipped a little further toward the reader, the
 * grip shifted subtly centered — genuinely ready to be opened, unopened.
 */
const ORIENTED_POSITION: [number, number, number] = [
  WORKING_EYE[0] +
    Math.sin(NEUTRAL_DIR.yaw) * HELD_FORWARD +
    Math.cos(NEUTRAL_DIR.yaw) * ORIENT_ASIDE,
  WORKING_EYE[1] - ORIENT_BELOW_EYE,
  WORKING_EYE[2] -
    Math.cos(NEUTRAL_DIR.yaw) * HELD_FORWARD +
    Math.sin(NEUTRAL_DIR.yaw) * ORIENT_ASIDE,
];

const ORIENTED_YAW = NEUTRAL_DIR.yaw + ORIENT_YAW_SKEW;

/**
 * The notebook's construction (WORK ORDER 0033): a page block with the
 * back cover, a hinged front cover pivoting at the spine (the edge
 * under the supporting hand), and a first page that exists physically
 * without becoming the subject — quiet paper, nothing on it.
 */
const COVER_THICKNESS = 0.003;
const BODY_THICKNESS = NOTEBOOK.thickness - COVER_THICKNESS;
/** The hinge line: spine edge, at the cover's resting mid-plane. */
const HINGE_Y = BODY_THICKNESS - NOTEBOOK.thickness / 2 + COVER_THICKNESS / 2;
/** Quiet paper — present, unmeaning. */
const PAGE_COLOR = "#6b665e";

/** Where the grip adjustment leaves the notebook (WORK ORDER 0032). */
const GRIPPED_POSITION: [number, number, number] = [
  ORIENTED_POSITION[0] + Math.cos(NEUTRAL_DIR.yaw) * GRIP_ASIDE_SHIFT,
  ORIENTED_POSITION[1] - GRIP_DIP,
  ORIENTED_POSITION[2] + Math.sin(NEUTRAL_DIR.yaw) * GRIP_ASIDE_SHIFT,
];

/**
 * Where the eyes arrive after the cover comes to rest (WORK ORDER
 * 0034): the center of the first visible page — the open notebook's
 * body, settled into the palm.
 */
const PAGE_GAZE: [number, number, number] = [
  GRIPPED_POSITION[0],
  GRIPPED_POSITION[1] - OPEN_SETTLE_DIP + 0.012,
  GRIPPED_POSITION[2],
];

/**
 * Where the first look down rests (WORK ORDER 0030): on the held
 * notebook itself — a hair above center, the way eyes land on a cover
 * rather than its geometric middle.
 */
const CONSIDER_POINT: [number, number, number] = [
  ORIENTED_POSITION[0],
  ORIENTED_POSITION[1] + 0.02,
  ORIENTED_POSITION[2],
];

/** Unit XZ direction from the working eyes toward the notebook at rest. */
const TOWARD_NOTEBOOK: [number, number] = (() => {
  const dx = REST_POSITION[0] - WORKING_EYE[0];
  const dz = REST_POSITION[2] - WORKING_EYE[2];
  const length = Math.hypot(dx, dz) || 1;
  return [dx / length, dz / length];
})();

/**
 * Where the eyes settle once the notebook is comfortably held: along
 * the body's facing, pitched gently down so the notebook rests low in
 * vision with the room beyond it.
 */
const HELD_REGARD: [number, number, number] = [
  WORKING_EYE[0] + Math.sin(NEUTRAL_DIR.yaw) * Math.cos(HELD_REGARD_PITCH) * 2,
  WORKING_EYE[1] + Math.sin(HELD_REGARD_PITCH) * 2,
  WORKING_EYE[2] - Math.cos(NEUTRAL_DIR.yaw) * Math.cos(HELD_REGARD_PITCH) * 2,
];

/**
 * Primitive blockout of the notebook — the first object with narrative
 * weight (WORK ORDER 0009); it rests in the ACTIVE zone at its
 * dominant-hand edge (WORK ORDER 0010).
 *
 * WORK ORDER 0027 — the first real interaction: once the room accepts
 * the visitor's offer, the body picks the notebook up. The TEMPORARY
 * commitment gesture is press-and-hold while ready (release early and
 * nothing happens); a dev-only ?autopickup=<seconds> runs the whole
 * sequence for motion capture. The order ends the instant the notebook
 * is comfortably held: nothing opens, nothing else changes.
 */
export function Notebook() {
  useAttentionTarget(ATTENTION_TARGET);
  useReadinessRule(READINESS_RULE);
  useAcceptancePolicy(ACCEPTANCE_POLICY);

  const camera = useThree((state) => state.camera);
  const meshRef = useRef<Group>(null);
  const coverRef = useRef<Group>(null);
  const pickupStart = useRef<number | null>(null);
  const pickedUp = useRef(false);
  const pickupDone = useRef(false);
  const gripStart = useRef<number | null>(null);
  const gripped = useRef(false);
  const openStart = useRef<number | null>(null);
  const opened = useRef(false);
  const seeStart = useRef<number | null>(null);
  const gaze = useRef<[number, number, number] | null>(null);

  const personPickup = useMemo<RoomBehavior>(
    () => ({
      name: "person-pickup",
      kind: "camera",
      enabled: true,
      onRoomTick: (clock) => {
        /* The moment intent matures, the visitor offers; if the room
           accepts, the body begins the pickup. */
        if (
          !pickedUp.current &&
          hasIntent("notebook") &&
          requestInteraction("notebook") === "accepted"
        ) {
          pickedUp.current = true;
          visitorState.holding = "notebook";
          pickupStart.current = -1;
          /* The eyes start the action wherever the visitor left them. */
          const forward = camera.getWorldDirection(new Vector3());
          gaze.current = [
            camera.position.x + forward.x,
            camera.position.y + forward.y,
            camera.position.z + forward.z,
          ];
        }
        /* Opening (WORK ORDER 0033): the visitor's third deliberate
           commitment — the first irreversible one. The cover rotates
           around its real hinge; the supporting hand answers. */
        if (
          gripped.current &&
          !opened.current &&
          openStart.current === null &&
          hasIntent("notebook") &&
          requestInteraction("notebook") === "accepted"
        ) {
          openStart.current = -1;
        }
        if (openStart.current !== null) {
          if (openStart.current === -1) openStart.current = clock.elapsed;
          const p = openProgress(clock.elapsed - openStart.current);
          const mesh = meshRef.current;
          const cover = coverRef.current;
          if (mesh && cover) {
            cover.rotation.z = OPEN_ANGLE * p;
            /* The hand releases part of the grip roll and the book
               settles as the cover's weight leaves the block. */
            mesh.rotation.z = GRIP_ROLL * (1 - OPEN_COUNTER_ROLL * p);
            mesh.position.y = GRIPPED_POSITION[1] - OPEN_SETTLE_DIP * p;
          }
          if (clock.elapsed - openStart.current >= OPEN_TOTAL) {
            openStart.current = null;
            opened.current = true;
            /* The physical act is over; vision arrives on its own. */
            seeStart.current = -1;
          }
          return;
        }

        /* Seeing (WORK ORDER 0034): after the cover rests, the eyes
           settle onto the first visible page — perception following
           the act, not a decision and not yet comprehension. */
        if (seeStart.current !== null && gaze.current !== null) {
          if (seeStart.current === -1) seeStart.current = clock.elapsed;
          const t = clock.elapsed - seeStart.current;
          const s = seeProgress(t);
          pursueGaze(
            gaze.current,
            [
              CONSIDER_POINT[0] + (PAGE_GAZE[0] - CONSIDER_POINT[0]) * s,
              CONSIDER_POINT[1] + (PAGE_GAZE[1] - CONSIDER_POINT[1]) * s,
              CONSIDER_POINT[2] + (PAGE_GAZE[2] - CONSIDER_POINT[2]) * s,
            ],
            clock.delta,
          );
          camera.lookAt(...gaze.current);
          if (t >= SEE_TOTAL) seeStart.current = null;
          return;
        }

        /* Finding the cover (WORK ORDER 0032): the visitor's second
           deliberate commitment, made while looking at what they hold.
           The room answers; only then do the hands prepare. */
        if (
          pickupDone.current &&
          !gripped.current &&
          gripStart.current === null &&
          hasIntent("notebook") &&
          requestInteraction("notebook") === "accepted"
        ) {
          gripStart.current = -1;
        }
        if (gripStart.current !== null) {
          if (gripStart.current === -1) gripStart.current = clock.elapsed;
          const g = gripProgress(clock.elapsed - gripStart.current);
          const mesh = meshRef.current;
          if (mesh) {
            /* Weight to the supporting hand; the opening edge lifts
               toward the thumb; the cover plane eases flatter. The
               gaze does not move — hands do not need to be watched. */
            mesh.position.set(
              ORIENTED_POSITION[0] +
                Math.cos(NEUTRAL_DIR.yaw) * GRIP_ASIDE_SHIFT * g,
              ORIENTED_POSITION[1] - GRIP_DIP * g,
              ORIENTED_POSITION[2] +
                Math.sin(NEUTRAL_DIR.yaw) * GRIP_ASIDE_SHIFT * g,
            );
            mesh.rotation.set(
              ORIENT_TILT + GRIP_TILT_EASE * g,
              ORIENTED_YAW,
              GRIP_ROLL * g,
            );
            ATTENTION_POSITION[0] = mesh.position.x;
            ATTENTION_POSITION[1] = mesh.position.y;
            ATTENTION_POSITION[2] = mesh.position.z;
          }
          if (clock.elapsed - gripStart.current >= GRIP_TOTAL) {
            gripStart.current = null;
            gripped.current = true;
          }
          return;
        }

        if (pickupStart.current === null || gaze.current === null) return;
        if (pickupStart.current === -1) pickupStart.current = clock.elapsed;

        const t = clock.elapsed - pickupStart.current;
        const pose = pickupPose(t, TOWARD_NOTEBOOK);
        const mesh = meshRef.current;
        if (mesh) {
          const at = carryPoint(REST_POSITION, HELD_POSITION, pose.carry);
          /* One unconscious adjustment after the settle: hold → oriented. */
          mesh.position.set(
            at[0] + (ORIENTED_POSITION[0] - HELD_POSITION[0]) * pose.orient,
            at[1] +
              pose.settleY +
              (ORIENTED_POSITION[1] - HELD_POSITION[1]) * pose.orient,
            at[2] + (ORIENTED_POSITION[2] - HELD_POSITION[2]) * pose.orient,
          );
          /* The notebook tilts toward the reader as it rises, turning
             to the hold's casual off-square angle — then, in the
             adjustment, nearly square and a touch further tipped. */
          mesh.rotation.set(
            HELD_TILT * pose.carry + (ORIENT_TILT - HELD_TILT) * pose.orient,
            NOTEBOOK.rotationY +
              (HELD_YAW - NOTEBOOK.rotationY) * pose.carry +
              (ORIENTED_YAW - HELD_YAW) * pose.orient,
            0,
          );
          camera.position.set(...pose.eye);
          /* Eyes on the object through the reach and grasp, rising to
             the settled regard as it arrives in the hold — then, after
             the hands have finished, the first deliberate look down. */
          const regard = gazeGoal(
            [at[0], at[1], at[2]],
            HELD_REGARD,
            pose.carry,
          );
          pursueGaze(
            gaze.current,
            [
              regard[0] + (CONSIDER_POINT[0] - regard[0]) * pose.lookDown,
              regard[1] + (CONSIDER_POINT[1] - regard[1]) * pose.lookDown,
              regard[2] + (CONSIDER_POINT[2] - regard[2]) * pose.lookDown,
            ],
            clock.delta,
          );
          camera.lookAt(...gaze.current);
          /* The room's sense of where the notebook is follows the
             notebook (WORK ORDER 0032). */
          ATTENTION_POSITION[0] = mesh.position.x;
          ATTENTION_POSITION[1] = mesh.position.y;
          ATTENTION_POSITION[2] = mesh.position.z;
        }
        if (pose.done) {
          pickupStart.current = null;
          pickupDone.current = true;
        }
      },
    }),
    [camera],
  );
  useRoomBehavior(personPickup);

  useEffect(() => {
    /* TEMPORARY commitment gesture: press and hold while ready — the
       same gesture offers the pickup and, later, finding the cover. */
    const onPointerDown = () => {
      if (!opened.current) beginCommit("notebook");
    };
    const onPointerUp = () => {
      releaseCommit();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);

    let autoTimers: number[] = [];
    if (process.env.NODE_ENV !== "production") {
      const auto = new URLSearchParams(window.location.search).get(
        "autopickup",
      );
      if (auto) {
        const startAt = Number(auto) * 1000;
        const dev = window as Window & {
          __setLook?: (yaw: number, pitch: number) => void;
        };
        autoTimers = [
          /* Look at the notebook, let observation mature... */
          window.setTimeout(() => dev.__setLook?.(0.33, -0.1), startAt),
          /* ...then commit and hold; the pipeline does the rest.
             beginCommit refuses until the room says ready, so keep
             offering until the commitment takes. */
          window.setTimeout(() => {
            const retry = window.setInterval(() => {
              if (pickedUp.current || beginCommit("notebook"))
                window.clearInterval(retry);
            }, 120);
            autoTimers.push(retry);
          }, startAt + 2500),
          /* ...and after the introduction has settled, the second
             decision: engage with what is held (WORK ORDER 0032). */
          window.setTimeout(() => {
            const retry = window.setInterval(() => {
              if (
                gripped.current ||
                (pickupDone.current && beginCommit("notebook"))
              )
                window.clearInterval(retry);
            }, 120);
            autoTimers.push(retry);
          }, startAt + 14000),
          /* ...then the third: the cover opens (WORK ORDER 0033). */
          window.setTimeout(() => {
            const retry = window.setInterval(() => {
              if (
                opened.current ||
                (gripped.current && beginCommit("notebook"))
              )
                window.clearInterval(retry);
            }, 120);
            autoTimers.push(retry);
          }, startAt + 20000),
        ];
      }
    }

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      autoTimers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  return (
    <group
      ref={meshRef}
      position={REST_POSITION}
      rotation-y={NOTEBOOK.rotationY}
    >
      {/* Page block and back cover. */}
      <mesh position={[0, -COVER_THICKNESS / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[NOTEBOOK.width, BODY_THICKNESS, NOTEBOOK.length]} />
        <meshStandardMaterial color={NOTEBOOK.color} />
      </mesh>
      {/* The first page: physically there, never the subject. */}
      <mesh
        position={[0, HINGE_Y - COVER_THICKNESS / 2 + 0.0002, 0]}
        rotation-x={-Math.PI / 2}
      >
        <planeGeometry
          args={[NOTEBOOK.width - 0.012, NOTEBOOK.length - 0.012]}
        />
        <meshStandardMaterial color={PAGE_COLOR} />
      </mesh>
      {/* The front cover, hinged at the spine. */}
      <group ref={coverRef} position={[-NOTEBOOK.width / 2, HINGE_Y, 0]}>
        <mesh position={[NOTEBOOK.width / 2, 0, 0]} castShadow receiveShadow>
          <boxGeometry
            args={[NOTEBOOK.width, COVER_THICKNESS, NOTEBOOK.length]}
          />
          <meshStandardMaterial color={NOTEBOOK.color} />
        </mesh>
        <JournalWords />
      </group>
    </group>
  );
}

/** Inset of the written block from the cover's edges. */
const WORDS_MARGIN = 0.008;
/** Canvas resolution for the written page (matches the cover's aspect). */
const WORDS_CANVAS = { width: 512, height: 726 } as const;

/**
 * The journal's words (WORK ORDER 0090) — the focused object IS the
 * content. When the JOURNAL conversation opens, a written paragraph
 * about Lazy A illuminates ON the notebook, rising out of the closed
 * cover exactly as far as the body leans (the interface writes the
 * level; see three/interface/journal.ts). Texture-level, not overlay:
 * the words live on the cover's own surface, lit and tone-mapped with
 * the room, correctly occluded by the pencil lying across it — and a
 * closed notebook quietly showing its words is the room refusing, once
 * again, to behave exactly how you expect.
 *
 * PLACEHOLDER TEXT, flagged for authorship (docs/THE_NOTEBOOK.md still
 * governs the notebook's true voice).
 */
function JournalWords() {
  const materialRef = useRef<MeshStandardMaterial>(null);
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = WORDS_CANVAS.width;
    canvas.height = WORDS_CANVAS.height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#efe8d8";
    context.font = 'italic 28px Georgia, "Iowan Old Style", serif';
    context.textBaseline = "top";
    /* The block sits low on the page, under the pencil's diagonal. */
    const lineHeight = 44;
    const top = canvas.height * 0.52;
    JOURNAL_PLACEHOLDER.forEach((line, index) => {
      context.fillText(line, 40, top + index * lineHeight);
    });
    const created = new CanvasTexture(canvas);
    created.colorSpace = SRGBColorSpace;
    created.anisotropy = 4;
    return created;
  }, []);

  /* The words rise with the lean, and rest invisible. */
  useFrame(() => {
    const material = materialRef.current;
    if (!material) return;
    const level = getJournalLevel();
    material.opacity = level;
    material.emissiveIntensity = level * JOURNAL_GLOW;
    material.visible = level > 0.001;
  });

  if (!texture) return null;
  return (
    <mesh
      position={[NOTEBOOK.width / 2, COVER_THICKNESS / 2 + 0.0003, 0]}
      rotation-x={-Math.PI / 2}
    >
      <planeGeometry
        args={[
          NOTEBOOK.width - WORDS_MARGIN * 2,
          NOTEBOOK.length - WORDS_MARGIN * 2,
        ]}
      />
      <meshStandardMaterial
        ref={materialRef}
        map={texture}
        transparent
        visible={false}
        emissive={"#f0e9da"}
        emissiveMap={texture}
        emissiveIntensity={0}
        depthWrite={false}
      />
    </mesh>
  );
}
