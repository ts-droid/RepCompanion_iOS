import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { extractYouTubeVideoId } from "@/lib/utils";

interface VideoPlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exerciseName: string;
  youtubeUrl: string;
  videoType: string | null;
}

export function VideoPlayerDialog({
  open,
  onOpenChange,
  exerciseName,
  youtubeUrl,
  videoType,
}: VideoPlayerDialogProps) {
  const videoId = extractYouTubeVideoId(youtubeUrl);
  
  if (!videoId) return null;

  const isShort = videoType === 'shorts';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isShort ? "max-w-md" : "max-w-3xl"}>
        <DialogHeader>
          <DialogTitle>{exerciseName}</DialogTitle>
        </DialogHeader>
        <div className={isShort ? "aspect-[9/16] w-full" : "aspect-video w-full"}>
          <iframe
            width="100%"
            height="100%"
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1`}
            title={exerciseName}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="rounded-md"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
