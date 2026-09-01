import { useId, useState } from 'react';
import type React from 'react';
import { submitContactForm } from '../../lib/api';

/**
 * Única isla de cliente real de este proyecto (junto con, eventualmente,
 * el slider del hero). Envía vía `submitContactForm()` (src/lib/api.ts),
 * que pega contra `PUBLIC_CONTACT_FORM_ENDPOINT` — el proxy PHP por
 * defecto, nunca contra el API con el token de content:read (ver ADR-002).
 *
 * Antigravity: el markup/estilos de acá son un stub funcional — ajustar a
 * las capturas de CICA360 manteniendo el manejo de estado (loading/success/
 * error/fields) tal cual, ya que está conectado 1:1 con el contrato real
 * de errores del API (ver docs/context/api/stamless-api-v1.md).
 */

type Status = 'idle' | 'submitting' | 'success' | 'error';

/**
 * Estado local del form: a diferencia de `ContactFormPayload`, acá
 * `phone` siempre es string (controlled input). El índice explícito es
 * necesario para que TS acepte pasar este objeto directo a
 * `submitContactForm()`, cuyo parámetro (`ContactFormPayload`) tiene su
 * propio índice — sin esto, tsc tira ts(2345) "Index signature ... is
 * missing" (mismo tipo de error que en src/lib/api.ts::qs()).
 */
interface ContactFormState {
  name: string;
  email: string;
  phone: string;
  message: string;
  [key: string]: string;
}

const initialForm: ContactFormState = { name: '', email: '', phone: '', message: '' };

export default function ContactForm() {
  const [form, setForm] = useState<ContactFormState>(initialForm);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  // Honeypot: campo real para bots, oculto visualmente (no display:none —
  // algunos bots lo detectan; se usa posicionamiento fuera de pantalla).
  const [honeypot, setHoneypot] = useState('');

  const formId = useId();

  function updateField<K extends keyof ContactFormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // React 19.2+ deprecó `FormEvent`/`FormEventHandler` para el evento
  // `submit` en favor de `SubmitEvent` (que sí expone `submitter`, entre
  // otras cosas). No es un tema de cómo se importa el tipo — el tipo en sí
  // está deprecado, por eso el fix anterior (namespace import) no alcanzaba.
  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (honeypot) {
      // Bot: fingimos éxito sin llamar al API, para no darle feedback útil.
      setStatus('success');
      return;
    }

    setStatus('submitting');
    setErrorMessage(null);
    setFieldErrors({});

    const result = await submitContactForm(form);

    if (result.success) {
      setStatus('success');
      setForm(initialForm);
      return;
    }

    setStatus('error');
    setErrorMessage(result.message);
    setFieldErrors(result.fields ?? {});
  }

  if (status === 'success') {
    return (
      <div role="status" className="rounded border border-green-300 bg-green-50 p-4 text-green-800">
        Gracias por escribirnos. Te vamos a contactar a la brevedad.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {/* Honeypot — oculto para personas, visible para bots que autocompletan todo. */}
      <div style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
        <label htmlFor={`${formId}-website`}>No completar este campo</label>
        <input
          id={`${formId}-website`}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor={`${formId}-name`} className="mb-1 block text-sm font-medium">
          Nombre
        </label>
        <input
          id={`${formId}-name`}
          name="name"
          type="text"
          required
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2"
        />
        {fieldErrors.name && <p className="mt-1 text-sm text-red-600">{fieldErrors.name[0]}</p>}
      </div>

      <div>
        <label htmlFor={`${formId}-email`} className="mb-1 block text-sm font-medium">
          Email
        </label>
        <input
          id={`${formId}-email`}
          name="email"
          type="email"
          required
          value={form.email}
          onChange={(e) => updateField('email', e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2"
        />
        {fieldErrors.email && <p className="mt-1 text-sm text-red-600">{fieldErrors.email[0]}</p>}
      </div>

      <div>
        <label htmlFor={`${formId}-phone`} className="mb-1 block text-sm font-medium">
          Teléfono <span className="font-normal text-gray-500">(opcional)</span>
        </label>
        <input
          id={`${formId}-phone`}
          name="phone"
          type="tel"
          value={form.phone}
          onChange={(e) => updateField('phone', e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2"
        />
        {fieldErrors.phone && <p className="mt-1 text-sm text-red-600">{fieldErrors.phone[0]}</p>}
      </div>

      <div>
        <label htmlFor={`${formId}-message`} className="mb-1 block text-sm font-medium">
          Mensaje
        </label>
        <textarea
          id={`${formId}-message`}
          name="message"
          required
          rows={4}
          value={form.message}
          onChange={(e) => updateField('message', e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2"
        />
        {fieldErrors.message && <p className="mt-1 text-sm text-red-600">{fieldErrors.message[0]}</p>}
      </div>

      {status === 'error' && errorMessage && (
        <p role="alert" className="text-sm text-red-600">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="rounded bg-gray-900 px-6 py-3 font-medium text-white disabled:opacity-50"
      >
        {status === 'submitting' ? 'Enviando…' : 'Enviar mensaje'}
      </button>
    </form>
  );
}
