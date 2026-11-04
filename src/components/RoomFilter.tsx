"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "./Icon";

export function RoomFilter({ rooms }: { rooms: { id: number; code: string }[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const value = sp.get("room") ?? "";
  return (
    <label className="pill" style={{ paddingRight: 10 }}>
      <span className="sr-only">ห้อง</span>
      <select
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(sp.toString());
          if (e.target.value) next.set("room", e.target.value);
          else next.delete("room");
          next.delete("limit");
          router.push(`/assets?${next.toString()}`);
        }}
      >
        <option value="">ทุกห้อง</option>
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>
            ห้อง {r.code}
          </option>
        ))}
      </select>
      <Icon name="chevronDown" size={15} stroke={2.4} />
    </label>
  );
}
