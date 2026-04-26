/**
 * SparkLine — خط بياني صغير (polyline + تعبئة شفافة)
 * بدون بيانات أو كلها صفر: خط متقطع أفقي في المنتصف
 */
export default function SparkLine({ data = [], color = '#185FA5', height = 36 }: any) {
  const W = 100;
  const H = height;
  const pad = 3;
  const nums = (data || []).map((v: any) => Number(v || 0));
  const empty = !nums.length || nums.every((v: any) => v === 0);

  if (empty) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} className="block">
        <line
          x1={pad} y1={H / 2}
          x2={W - pad} y2={H / 2}
          className="stroke-noorix-border"
          strokeWidth="1"
          strokeDasharray="5 5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  }

  const max = Math.max(...nums);
  const min = Math.min(...nums);
  const range = Math.max(max - min, 1e-9);
  const n = nums.length;
  const xs = nums.map((_: any, i: any) => (n === 1 ? W / 2 : pad + (i / (n - 1)) * (W - 2 * pad)));
  const ys = nums.map((v: any) => pad + (1 - (v - min) / range) * (H - 2 * pad));
  const points = xs.map((x: any, i: any) => `${x},${ys[i]}`).join(' ');
  const fillPoints = `${points} ${xs[n - 1]},${H} ${xs[0]},${H}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} className="block">
      <polygon points={fillPoints} fill={color} fillOpacity={0.08} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
