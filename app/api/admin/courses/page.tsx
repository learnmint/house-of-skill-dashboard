'use client';

import { useEffect, useState } from 'react';

type Course = {
  id: string;
  name: string;
  whatsapp_community_link: string | null;
};

export default function CoursesAdminPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/courses'); // you’ll create this GET route
        const data = await res.json();
        setCourses(data);
      } catch (e) {
        setError('Failed to load courses');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const updateWhatsapp = async (id: string, link: string) => {
    setSavingId(id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/courses/${id}/whatsapp`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp_community_link: link }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to update link');
      }

      const updated = await res.json();

      setCourses((prev) =>
        prev.map((c) => (c.id === id ? { ...c, whatsapp_community_link: updated.whatsapp_community_link } : c))
      );
      setSuccess('WhatsApp link updated');
    } catch (e: any) {
      setError(e.message || 'Error updating link');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <p style={{ padding: 32 }}>Loading...</p>;

  return (
    <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Courses</h1>

      {error && (
        <p style={{ color: 'red', marginBottom: '12px' }}>
          {error}
        </p>
      )}
      {success && (
        <p style={{ color: 'green', marginBottom: '12px' }}>
          {success}
        </p>
      )}

      {courses.map((course) => (
        <div
          key={course.id}
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px',
          }}
        >
          <div style={{ marginBottom: '8px', fontWeight: 600 }}>
            {course.name}
          </div>

          <label
            style={{
              display: 'block',
              fontSize: '13px',
              color: '#6b7280',
              marginBottom: '4px',
            }}
          >
            WhatsApp community link
          </label>

          <input
            type="text"
            value={course.whatsapp_community_link || ''}
            onChange={(e) => {
              const value = e.target.value;
              setCourses((prev) =>
                prev.map((c) =>
                  c.id === course.id ? { ...c, whatsapp_community_link: value } : c
                )
              );
            }}
            placeholder="https://chat.whatsapp.com/..."
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              fontSize: '14px',
              marginBottom: '8px',
            }}
          />

          <button
            onClick={() =>
              updateWhatsapp(course.id, course.whatsapp_community_link || '')
            }
            disabled={savingId === course.id}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: savingId === course.id ? '#9ca3af' : '#16a34a',
              color: 'white',
              fontSize: '14px',
              fontWeight: 500,
              cursor: savingId === course.id ? 'default' : 'pointer',
            }}
          >
            {savingId === course.id ? 'Saving...' : 'Save link'}
          </button>
        </div>
      ))}
    </div>
  );
}
