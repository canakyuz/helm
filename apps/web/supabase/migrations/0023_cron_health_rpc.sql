-- helm_cron_status() — cron.job + son N run'ı authenticated/service_role'e açar.
-- SECURITY DEFINER ile cron schema'sına erişir (default'ta sadece postgres'in).

create or replace function public.helm_cron_status(limit_runs int default 10)
returns table (
  jobname text,
  schedule text,
  active boolean,
  last_runs jsonb
)
language sql
security definer
set search_path = public, cron
as $$
  select
    j.jobname::text,
    j.schedule::text,
    j.active,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'runid', r.runid,
          'job_pid', r.job_pid,
          'start_time', r.start_time,
          'end_time', r.end_time,
          'status', r.status,
          'return_message', r.return_message
        ) order by r.start_time desc)
        from cron.job_run_details r
        where r.jobid = j.jobid
        order by r.start_time desc
        limit limit_runs
      ),
      '[]'::jsonb
    ) as last_runs
  from cron.job j
  where j.jobname like 'helm-%'
  order by j.jobname;
$$;

grant execute on function public.helm_cron_status(int) to authenticated, service_role;
