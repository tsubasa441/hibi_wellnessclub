import EventForm from "../EventForm";

export default function NewEventPage() {
  return (
    <div>
      <h1 className="font-cormorant text-2xl font-semibold text-ink-700 mb-6">イベントを作成</h1>
      <EventForm mode="create" />
    </div>
  );
}
