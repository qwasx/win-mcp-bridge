// 联机钩子：单机时全部为空操作；联机客户端连接后由 net/client.ts 填充
export interface ReqResult { ok: boolean; data?: any; err?: string }
export const NETH = {
  on: false,
  eid: 0,       // 当前遭遇 id（服务器分配）
  name: '',     // 本人账号
  req: (_op: string, _args?: any): Promise<ReqResult> => Promise.resolve({ ok: true }),
  send: (_m: any): void => {},
};
