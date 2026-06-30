#!/bin/bash
URL="https://lzfgjvafmvofwjiyvelq.supabase.co/functions/v1/ingest-vision"
RANGES="5:25 26:45 46:65 66:89 90:111 112:137"
for R in $RANGES; do
  F=${R%:*}; T=${R#*:}
  echo "── فصل صفحات $F..$T"
  curl -s -X POST "$URL" -H "Authorization: Bearer $KEY" -H "apikey: $KEY" -H "Content-Type: application/json" \
    -d "{\"subject_id\":\"cbb340d9-ae4b-4de5-89b0-5572c3a9524d\",\"grade_id\":\"26ba396e-f8bc-4842-b7e4-a85ff3312ec5\",\"part_number\":1,\"book_slug\":\"math-grade1-part1\",\"page_from\":$F,\"page_to\":$T,\"mode\":\"commit\"}" \
    | grep -o '"lessons_written":[0-9]*\|"chunks_written":[0-9]*' | tr '\n' ' '; echo
  sleep 2
done
echo "════ انتهى الكتاب"
