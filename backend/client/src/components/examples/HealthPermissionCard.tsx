import HealthPermissionCard from "../HealthPermissionCard";

export default function HealthPermissionCardExample() {
  return (
    <HealthPermissionCard
      onAllow={() => console.log("Health access allowed")}
      onDeny={() => console.log("Health access denied")}
    />
  );
}
