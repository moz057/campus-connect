import { useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  X,
  GraduationCap,
  Printer,
  CalendarDays,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import type { CampusEvent, Registration } from "../lib/types";
import { useAuth } from "../contexts/AuthContext";
import { dateLabel, timeLabel } from "../lib/utils";
export default function Ticket({
  event,
  registration,
  onClose,
}: {
  event: CampusEvent;
  registration: Registration;
  onClose: () => void;
}) {
  const { profile, demo } = useAuth();
  const modal = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const focusables = () =>
      modal.current?.querySelectorAll<HTMLElement>(
        'button,a[href],input,[tabindex="0"]',
      );
    focusables()?.[0]?.focus();
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const nodes = focusables();
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        ref={modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-title"
        className="ticket-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close icon-button"
          aria-label="Close ticket"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <div className="ticket-header">
          <GraduationCap size={27} />
          <strong>CampusConnect</strong>
          <span>YOUR CAMPUS PASS</span>
        </div>
        <div className="ticket-content">
          <span className="success-badge">
            <ShieldCheck size={13} /> Registration confirmed
          </span>
          <h2 id="ticket-title">{event.title}</h2>
          <p>
            <CalendarDays size={15} />
            {dateLabel(event.start_time)} · {timeLabel(event.start_time)}
          </p>
          <p>
            <MapPin size={15} />
            {event.venue}
          </p>
          <div className="ticket-qr">
            <QRCodeSVG
              value={JSON.stringify({
                v: 1,
                event_id: event.id,
                token: registration.qr_token,
              })}
              size={190}
              level="M"
              marginSize={2}
            />
          </div>
          <h3>{profile?.full_name}</h3>
          <span className="muted">{profile?.student_id}</span>
          <div className="ticket-divider" />
          <p className="ticket-instructions">
            Show this QR code to an organizer at the venue.
            <br />
            Keep your ticket private. It can only be used once.
          </p>
          {demo && (
            <small className="demo-ticket-note">
              DEMO TICKET · No real event registration
            </small>
          )}
          <button
            className="button primary full-width"
            onClick={() => window.print()}
          >
            <Printer size={16} />
            Print / save ticket
          </button>
        </div>
      </section>
    </div>
  );
}
