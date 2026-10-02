-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "script_type" AS ENUM ('nonstandard', 'pubkey', 'pubkeyhash', 'scripthash', 'multisig', 'nulldata', 'anchor', 'witness_v0_keyhash', 'witness_v0_scripthash', 'witness_v1_taproot', 'witness_unknown');

-- CreateTable
CREATE TABLE "block" (
    "height" INTEGER NOT NULL,
    "hash" BYTEA NOT NULL,
    "prev_hash" BYTEA,
    "merkle_root" BYTEA NOT NULL,
    "chainwork" BYTEA NOT NULL,
    "version" INTEGER NOT NULL,
    "bits" BIGINT NOT NULL,
    "nonce" BIGINT NOT NULL,
    "difficulty" DOUBLE PRECISION NOT NULL,
    "time" TIMESTAMPTZ(0) NOT NULL,
    "median_time" TIMESTAMPTZ(0) NOT NULL,
    "size" INTEGER NOT NULL,
    "stripped_size" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL,
    "tx_count" INTEGER NOT NULL,
    "subsidy_sats" BIGINT NOT NULL,
    "total_fee_sats" BIGINT NOT NULL,
    "total_out_sats" BIGINT NOT NULL,

    CONSTRAINT "block_pkey" PRIMARY KEY ("height")
);

-- CreateTable
CREATE TABLE "transaction" (
    "tx_num" BIGINT NOT NULL,
    "txid" BYTEA NOT NULL,
    "wtxid" BYTEA,
    "block_height" INTEGER NOT NULL,
    "version" BIGINT NOT NULL,
    "locktime" BIGINT NOT NULL,
    "size" INTEGER NOT NULL,
    "vsize" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL,
    "input_count" INTEGER NOT NULL,
    "output_count" INTEGER NOT NULL,
    "is_coinbase" BOOLEAN NOT NULL,
    "fee_sats" BIGINT,

    CONSTRAINT "transaction_pkey" PRIMARY KEY ("tx_num")
);

-- CreateTable
CREATE TABLE "tx_output" (
    "tx_num" BIGINT NOT NULL,
    "vout" INTEGER NOT NULL,
    "value_sats" BIGINT NOT NULL,
    "script_pubkey" BYTEA NOT NULL,
    "script_type" "script_type" NOT NULL,
    "address" TEXT,

    CONSTRAINT "tx_output_pkey" PRIMARY KEY ("tx_num","vout")
);

-- CreateTable
CREATE TABLE "tx_input" (
    "tx_num" BIGINT NOT NULL,
    "vin" INTEGER NOT NULL,
    "prev_tx_num" BIGINT,
    "prev_vout" INTEGER,
    "sequence" BIGINT NOT NULL,
    "script_sig" BYTEA NOT NULL,
    "witness" BYTEA[],

    CONSTRAINT "tx_input_pkey" PRIMARY KEY ("tx_num","vin")
);

-- CreateTable
CREATE TABLE "sync_state" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "network" TEXT NOT NULL,
    "node_tip_height" INTEGER NOT NULL,
    "indexed_tip_height" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sync_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "block_hash_key" ON "block"("hash");

-- CreateIndex
CREATE INDEX "transaction_txid_idx" ON "transaction"("txid");

-- CreateIndex
CREATE INDEX "transaction_block_height_idx" ON "transaction"("block_height");

-- CreateIndex
CREATE UNIQUE INDEX "tx_input_prevout_key" ON "tx_input"("prev_tx_num", "prev_vout");

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_block_height_fkey" FOREIGN KEY ("block_height") REFERENCES "block"("height") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tx_output" ADD CONSTRAINT "tx_output_tx_num_fkey" FOREIGN KEY ("tx_num") REFERENCES "transaction"("tx_num") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tx_input" ADD CONSTRAINT "tx_input_tx_num_fkey" FOREIGN KEY ("tx_num") REFERENCES "transaction"("tx_num") ON DELETE RESTRICT ON UPDATE CASCADE;

-- sync_state holds exactly one row
ALTER TABLE "sync_state" ADD CONSTRAINT "sync_state_single_row" CHECK ("id" = 1);
