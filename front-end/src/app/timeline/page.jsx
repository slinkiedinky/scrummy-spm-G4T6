"use client";

import React from "react";
import Timeline from "@/components/Timeline";
import { RoleGuard } from "@/components/RoleGuard";

export default function TimelinePage() {
  return <RoleGuard allowedRoles={["Staff", "Manager"]}>
    <Timeline />;
  </RoleGuard>;
}
