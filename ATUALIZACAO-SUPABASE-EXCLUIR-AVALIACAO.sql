-- Atualização sem segredos: permite excluir avaliações com segurança.
-- Execute uma vez no SQL Editor do Supabase.
-- Professor: pode excluir somente a própria avaliação.
-- Coordenação: pode excluir qualquer avaliação da escola.

grant delete on public.evaluations to authenticated;

drop policy if exists evaluations_delete_own_or_coordination on public.evaluations;
create policy evaluations_delete_own_or_coordination on public.evaluations
for delete to authenticated
using (
  public.has_school_access()
  and (
    teacher_id = (select auth.uid())
    or public.is_coordination()
  )
);
