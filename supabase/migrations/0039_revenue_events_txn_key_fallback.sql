-- txn_key icin veritabani tarafinda emniyet agi.
--
-- NEDEN VAR: 0038 txn_key'i NOT NULL yapti, ama edge function ayri deploy edilir.
-- Ikisi ayni anda canliya cikmaz. Aradaki pencerede ESKI fonksiyon txn_key
-- gondermeden yazmaya calisir ve HER webhook olayi hata alir - yani tam olarak
-- kacirmamak icin bu isi yaptigimiz odemeler kaybolur.
--
-- Trigger, txn_key bos gelirse ayni anahtari SQL tarafinda uretir. Yeni fonksiyon
-- deploy edildiginde anahtari kendisi doldurur ve trigger sessizce devre disi
-- kalir (before insert, yalnizca null ise calisir).
--
-- MANTIK KOPYASI UYARISI: bu fonksiyon index.ts'teki txnKey()'in birebir
-- karsiligidir. Anahtar bicimini degistirirsen IKISINI birden degistir, yoksa
-- ayni odeme iki farkli anahtarla iki satir olur.

create or replace function public.revenue_events_fill_txn_key()
returns trigger
language plpgsql
as $$
declare
  ev jsonb := coalesce(new.raw -> 'event', '{}'::jsonb);
  orig text := coalesce(ev ->> 'original_transaction_id', ev ->> 'transaction_id');
  occurred_ms bigint := (extract(epoch from new.occurred_at) * 1000)::bigint;
  is_revenue boolean := new.event_type in (
    'INITIAL_PURCHASE', 'RENEWAL', 'NON_RENEWING_PURCHASE',
    'UNCANCELLATION', 'PRODUCT_CHANGE'
  );
begin
  if new.txn_key is not null then
    return new;
  end if;

  -- Gelir uretmeyen olay (iptal, odeme sorunu) parayla ayrisamaz: satin almanin
  -- kopyasi sanilip yutulmasin diye olay kimligiyle anahtarlanir.
  if not is_revenue or orig is null then
    new.txn_key := 'evt:' || coalesce(new.event_id, new.id::text);
  else
    new.txn_key := coalesce(new.store, 'unknown') || ':' || orig || ':' || occurred_ms;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_revenue_events_fill_txn_key on public.revenue_events;
create trigger trg_revenue_events_fill_txn_key
  before insert on public.revenue_events
  for each row execute function public.revenue_events_fill_txn_key();

comment on function public.revenue_events_fill_txn_key is
  'txn_key bos gelirse index.ts txnKey() ile ayni anahtari uretir. Edge function deploy gecikmesinde odeme kaybini onler.';
