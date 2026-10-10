-- @param {Int} $1:height
-- @param {Int} $2:afterPosition
-- @param {Int} $3:limit
SELECT
  t.txid,
  t.position,
  t.fee_sat AS "feeSat",
  t.vsize,
  t.is_coinbase AS "isCoinbase",
  (SELECT count(*)::int FROM transaction_input i WHERE i.transaction_id = t.id) AS "inputCount",
  (SELECT count(*)::int FROM transaction_output o WHERE o.transaction_id = t.id) AS "outputCount",
  CASE WHEN t.is_coinbase THEN NULL
       ELSE (SELECT sum(i.prev_value_sat)::bigint FROM transaction_input i WHERE i.transaction_id = t.id)
  END AS "totalInSat",
  (SELECT coalesce(sum(o.value_sat), 0)::bigint FROM transaction_output o WHERE o.transaction_id = t.id) AS "totalOutSat"
FROM transaction t
WHERE t.block_height = $1 AND t.position > $2
ORDER BY t.position
LIMIT $3
