-- CreateTable
CREATE TABLE "block" (
    "height" INTEGER NOT NULL,
    "hash" CHAR(64) NOT NULL,
    "prev_hash" CHAR(64),
    "merkle_root" CHAR(64) NOT NULL,
    "version" INTEGER NOT NULL,
    "bits" CHAR(8) NOT NULL,
    "nonce" BIGINT NOT NULL,
    "difficulty" DOUBLE PRECISION NOT NULL,
    "time" BIGINT NOT NULL,
    "median_time" BIGINT NOT NULL,
    "size" INTEGER NOT NULL,
    "stripped_size" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL,
    "tx_count" INTEGER NOT NULL,
    "subsidy_sat" BIGINT NOT NULL,
    "total_fee_sat" BIGINT NOT NULL,

    CONSTRAINT "block_pkey" PRIMARY KEY ("height")
);

-- CreateTable
CREATE TABLE "transaction" (
    "id" BIGSERIAL NOT NULL,
    "txid" CHAR(64) NOT NULL,
    "block_height" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "locktime" BIGINT NOT NULL,
    "size" INTEGER NOT NULL,
    "vsize" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL,
    "fee_sat" BIGINT,
    "is_coinbase" BOOLEAN NOT NULL,

    CONSTRAINT "transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_output" (
    "transaction_id" BIGINT NOT NULL,
    "index" INTEGER NOT NULL,
    "value_sat" BIGINT NOT NULL,
    "script_type" TEXT NOT NULL,
    "address" TEXT,
    "script_hex" TEXT NOT NULL,
    "spent_by_transaction_id" BIGINT,
    "spent_by_input_index" INTEGER,

    CONSTRAINT "transaction_output_pkey" PRIMARY KEY ("transaction_id","index")
);

-- CreateTable
CREATE TABLE "transaction_input" (
    "transaction_id" BIGINT NOT NULL,
    "index" INTEGER NOT NULL,
    "prev_txid" CHAR(64),
    "prev_index" INTEGER,
    "prev_value_sat" BIGINT,
    "prev_address" TEXT,
    "prev_script_type" TEXT,
    "sequence" BIGINT NOT NULL,
    "script_sig_hex" TEXT,
    "witness" TEXT[],
    "coinbase_hex" TEXT,

    CONSTRAINT "transaction_input_pkey" PRIMARY KEY ("transaction_id","index")
);

-- CreateIndex
CREATE UNIQUE INDEX "block_hash_key" ON "block"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_txid_key" ON "transaction"("txid");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_block_height_position_key" ON "transaction"("block_height", "position");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_output_spent_by_transaction_id_spent_by_input_i_key" ON "transaction_output"("spent_by_transaction_id", "spent_by_input_index");

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_block_height_fkey" FOREIGN KEY ("block_height") REFERENCES "block"("height") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_output" ADD CONSTRAINT "transaction_output_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_output" ADD CONSTRAINT "transaction_output_spent_by_transaction_id_spent_by_input__fkey" FOREIGN KEY ("spent_by_transaction_id", "spent_by_input_index") REFERENCES "transaction_input"("transaction_id", "index") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_input" ADD CONSTRAINT "transaction_input_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

