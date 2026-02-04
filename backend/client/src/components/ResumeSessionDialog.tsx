import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { WorkoutSession } from "@shared/schema";

interface ResumeSessionDialogProps {
  session: WorkoutSession | null;
  open: boolean;
  onResume: () => void;
  onCancel: () => void;
}

export function ResumeSessionDialog({ session, open, onResume, onCancel }: ResumeSessionDialogProps) {
  if (!session) return null;

  const startedDate = new Date(session.startedAt);
  const formattedDate = startedDate.toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <AlertDialog open={open}>
      <AlertDialogContent data-testid="dialog-resume-session">
        <AlertDialogHeader>
          <AlertDialogTitle>Fortsätt påbörjat pass?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Du har ett påbörjat träningspass som inte har avslutats:
              </p>
              <div className="bg-muted/50 p-3 rounded-md mt-2">
                <p className="font-medium text-foreground">{session.sessionName}</p>
                <p className="text-sm text-muted-foreground">Startad {formattedDate}</p>
              </div>
              <p className="mt-3">
                Vill du fortsätta där du slutade?
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} data-testid="button-cancel-resume">
            Avsluta passet
          </AlertDialogCancel>
          <AlertDialogAction onClick={onResume} data-testid="button-confirm-resume">
            Ja, fortsätt träning
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
