export * from "./protocol";
export * from "./player";
export * from "./registry";

/**
 * v0.1 过渡出口：Web 端需要模块的 state 类型才能渲染。
 * 后续每个模块独立成包时，类型与渲染器应随模块一起发布（见 docs/architecture-proposal.md §8）。
 */
export type { CacheInput, CacheState, CacheEvent } from "./modules/cache-direct-mapped/types";
export type {
  ReplacementInput,
  ReplacementState,
  ReplacementEvent,
  ReplacementAlg,
} from "./modules/page-replacement/types";
export type {
  TreeInput,
  TreeState,
  TreeEvent,
  TreeOrder,
  TraversalMode,
} from "./modules/binary-tree-traversal/types";
export type {
  TcpInput,
  TcpState,
  TcpEvent,
  TcpPacket,
  TcpScenario,
  TcpConnState,
} from "./modules/tcp-handshake/types";
export type { CacheLineState } from "./modules/cache-direct-mapped/types";
export type { AssocInput, AssocState, AssocEvent } from "./modules/cache-associative/types";
export type { SortInput, SortState, SortEvent, SortAlgorithm } from "./modules/sorting/types";
export type { GraphInput, GraphState, GraphEvent, GraphMode } from "./modules/graph-traversal/types";
export type { SearchInput, SearchState, SearchEvent, SearchMode } from "./modules/search/types";
export type {
  SchedInput,
  SchedState,
  SchedEvent,
  SchedProcess,
  SchedAlgorithm,
} from "./modules/scheduling/types";
export type { SubnetInput, SubnetState, SubnetEvent } from "./modules/subnetting/types";
export type {
  SendInput,
  SendState,
  SendEvent,
  SegmentInfo,
  PacketInfo,
  FragmentInfo,
} from "./modules/network-send/types";
export type {
  ExecInput,
  ExecState,
  ExecEvent,
  AsmInstruction,
  PipeCell,
} from "./modules/program-execution/types";
export type {
  CrossInput,
  CrossState,
  CrossEvent,
  CrossStats,
} from "./modules/va-access-chain/types";

export * from "./view";
export { batch1 } from "./modules/generic/batch1";
export { batch2 } from "./modules/generic/batch2";
export { batch3 } from "./modules/generic/batch3";
export { batch4 } from "./modules/generic/batch4";
export { batch5 } from "./modules/generic/batch5";
export { batch6 } from "./modules/generic/batch6";
export { batch7 } from "./modules/generic/batch7";
