/**
 * 백엔드 규칙 묶음과 다르게 보정하는 값. 백엔드에 반영되면 여기서 지운다.
 * (종합설계 4과목 택1은 백엔드에 들어가서 지웠다)
 */

/** 공지상 컴퓨터학부 개설인데 교육과정표에 타 전공 개설로 잡힌 과목 */
export const DEPARTMENT_OFFERED_OVERRIDES = new Set(['ITEC0401', 'ITEC0402', 'GLSO0218', 'GLSO0221'])
