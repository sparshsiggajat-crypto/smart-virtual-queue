import { useQueue } from "../store/queueStore.tsx";

export function NoticeBar() {
  const { notice } = useQueue();
  return notice ? <div className="notice" role="status">📢 {notice}</div> : null;
}
