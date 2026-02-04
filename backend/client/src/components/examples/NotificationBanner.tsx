import NotificationBanner from "../NotificationBanner";

export default function NotificationBannerExample() {
  return (
    <div className="p-4">
      <NotificationBanner
        message="Träningsdag! Mät effekten av din aktivitet genom att ansluta din pulsmätare."
        icon="💪"
        onDismiss={() => console.log("Notification dismissed")}
      />
    </div>
  );
}
