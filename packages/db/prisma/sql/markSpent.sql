-- @param {Int} $1:height
WITH marked AS (
  UPDATE transaction_output AS o
  SET spent_by_transaction_id = i.transaction_id,
      spent_by_input_index = i.index
  FROM transaction_input AS i
  JOIN transaction AS spender ON spender.id = i.transaction_id
  JOIN transaction AS funding ON funding.txid = i.prev_txid
  WHERE spender.block_height = $1
    AND o.transaction_id = funding.id
    AND o.index = i.prev_index
    -- Never overwrite a spend: a re-spend lowers the count and the writer rejects the block.
    AND o.spent_by_transaction_id IS NULL
  RETURNING 1
)
SELECT count(*)::int AS "markedCount" FROM marked
