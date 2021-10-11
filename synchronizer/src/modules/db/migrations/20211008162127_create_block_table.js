
exports.up = async function (knex) {
    const tableExists = await knex.schema.hasTable('block')

    if (!tableExists) {
        return await knex.schema.createTable('block', table => {
            table.increments('id').primary()
            table.string('hash').notNullable()
            table.bigInteger('confirmations').notNullable()
            table.bigInteger('size').notNullable()
            table.bigInteger('stripped_size').notNullable()
            table.bigInteger('weight').notNullable()
            table.bigInteger('height').notNullable()
            table.integer('version').notNullable()
            table.string('version_hex').notNullable()
            table.string('merkle_root').notNullable()
            table.bigInteger('time').unsigned().notNullable()
            table.bigInteger('median_time').unsigned().notNullable()
            table.bigInteger('nonce').unsigned().notNullable()
            table.string('bits').notNullable()
            table.decimal('difficulty', null, 2).notNullable()
            table.bigInteger('tx_count').notNullable()
            table.string('previous_block_hash')
            table.string('next_block_hash')
            table.decimal('total_utxo_value', null, null).notNullable()
            table.decimal('total_fee_value', null, null).notNullable()
            table.decimal('reward_value', null, null).notNullable()
        })
    }
};

exports.down = async function (knex) {
    return await knex.schema.dropTableIfExists('block')
};
