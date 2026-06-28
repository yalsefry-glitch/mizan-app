// components/games/types.ts
// عقد مشترك لكل ألعاب المكافأة: تتلقّى أبعاد منطقة اللعب،
// وتُبلّغ بعدد الجواهر المكتسبة (١-٥) عند الانتهاء عبر onFinish.

export interface GameProps {
  // أبعاد منطقة اللعب بالبكسل (Canvas يتطلّب أبعادًا ثابتة).
  width: number;
  height: number;
  // ينادى مرّة واحدة عند انتهاء اللعبة بعدد الجواهر المكتسبة.
  onFinish: (gems: number) => void;
}

export type GameId = 'draw' | 'mirror' | 'pulse' | 'rotate';
