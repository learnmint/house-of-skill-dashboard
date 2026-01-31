import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function PATCH(request: any, context: any) {
  // ⬇️ IMPORTANT: await context.params
  const params = await context.params;
  const id = params?.id as string | undefined;

  if (!id) {
    console.error('PATCH /api/courses/[id]/whatsapp called without id');
    return NextResponse.json(
      { error: 'Course id is required' },
      { status: 400 }
    );
  }

  const body = await request.json();
  const whatsapp_community_link = body.whatsapp_community_link as string | null;

  const { data, error } = await supabase
    .from('courses')
    .update({ whatsapp_community_link })
    .eq('id', id)
    .select('id, name, whatsapp_community_link')
    .single();

  if (error) {
    console.error('Supabase error updating course:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}
