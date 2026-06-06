// WBS 階層と標準工程の展開 (US-013)。DB 非依存の純粋関数。
// 階層: level1=機能 / level2=対象(画面/帳票/テーブル) / level3=作業タスク(工程)。

/** 標準工程(開発工程の既定セット)。 */
export const STANDARD_PHASES = ['基本設計', '詳細設計', 'コーディング', '単体テスト', '結合テスト'];

export interface WbsNodeSpec {
  /** 生成時の仮ID(親参照の解決用)。 */
  tempId: string;
  parentTempId: string | null;
  level: 1 | 2 | 3;
  wbsId: string;
  name: string;
  phase: string | null;
}

/**
 * 1 機能分の WBS ノードを採番付きで展開する。
 * - 対象(targets)があれば level2 を挟み、level3 を `feat.tgt.phase` で採番
 * - 対象が無ければ level3 を `feat.phase` で直接ぶら下げる
 * - wbsId は `1` / `1.1` / `1.1.1` 形式
 */
export function expandWbs(
  featureNo: number,
  featureName: string,
  targets: string[],
  phases: string[] = STANDARD_PHASES,
): WbsNodeSpec[] {
  const nodes: WbsNodeSpec[] = [];
  const feat: WbsNodeSpec = {
    tempId: 'f',
    parentTempId: null,
    level: 1,
    wbsId: String(featureNo),
    name: featureName,
    phase: null,
  };
  nodes.push(feat);

  if (targets.length > 0) {
    targets.forEach((target, ti) => {
      const l2Id = `t${ti}`;
      nodes.push({
        tempId: l2Id,
        parentTempId: 'f',
        level: 2,
        wbsId: `${featureNo}.${ti + 1}`,
        name: target,
        phase: null,
      });
      phases.forEach((phase, pi) => {
        nodes.push({
          tempId: `${l2Id}p${pi}`,
          parentTempId: l2Id,
          level: 3,
          wbsId: `${featureNo}.${ti + 1}.${pi + 1}`,
          name: `${target} ${phase}`,
          phase,
        });
      });
    });
  } else {
    phases.forEach((phase, pi) => {
      nodes.push({
        tempId: `p${pi}`,
        parentTempId: 'f',
        level: 3,
        wbsId: `${featureNo}.${pi + 1}`,
        name: phase,
        phase,
      });
    });
  }

  return nodes;
}
