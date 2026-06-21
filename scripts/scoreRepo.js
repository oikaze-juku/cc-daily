// GitHubリポの健全性シグナルから信頼ラベル（🟦健全 / 🟨要注意）を決める純粋関数。
// ★数は主軸にしない（偽スター問題）。asOf を渡して決定的にする。
const DAY = 24 * 60 * 60 * 1000;

export function scoreRepo(meta, asOf) {
  const reasons = [];
  const daysSincePush = Math.floor((asOf.getTime() - new Date(meta.pushedAt).getTime()) / DAY);

  if (daysSincePush > 365) reasons.push(`最終更新が${daysSincePush}日前（1年超）`);
  if (!meta.license) reasons.push('ライセンス未記載');
  if (meta.stars >= 1000 && meta.forks / meta.stars < 0.02) {
    reasons.push('スター数に対しfork極端に少ない（偽スター疑い）');
  }
  return { label: reasons.length > 0 ? '🟨' : '🟦', reasons };
}
