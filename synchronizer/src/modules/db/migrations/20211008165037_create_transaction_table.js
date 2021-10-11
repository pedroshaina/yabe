
exports.up = async function(knex) {
    const tableExists = await knex.schema.hasTable('transaction')

    if (!tableExists) {
        const promises = []

        promises.push(knex.schema.createTable('transaction', table => {
            table.increments('id').primary()
            table.string('txid').notNullable()
            table.string('hash').notNullable()
            table.bigInteger('size').notNullable()
            table.bigInteger('vsize').notNullable()
            table.bigInteger('weight').notNullable()
            table.integer('version').notNullable()
            table.bigInteger('locktime').notNullable()
            table.string('block_hash').notNullable()
            table.boolean('is_coinbase').notNullable()
            table.bigInteger('input_count').notNullable()
            table.bigInteger('output_count').notNullable()
            table.decimal('total_input_value', null, null).notNullable()
            table.decimal('total_output_value', null, null).notNullable()
            table.decimal('fee_value', null, null).notNullable()
        }));

        promises.push(knex.schema.createTable('transaction_input', table => {
            table.increments('id').primary()
            table.integer('transaction_id')
                .unsigned()
                .references('transaction.id')
                .notNullable()
            table.string('source_output_txid')
            table.bigInteger('source_output_index')
            table.boolean('has_witness').notNullable()
            table.text('coinbase_data')
            table.integer('script_sig_id')
                .references('script_sig.id')
            table.bigInteger('sequence')
        }))

        promises.push(knex.schema.createTable('transaction_output', table => {
            table.increments('id').primary()
            table.integer('transaction_id')
                .unsigned()
                .references('transaction.id')
                .notNullable()
            table.decimal('value', null, null).notNullable()
            table.bigInteger('index').notNullable()
            table.integer('script_pub_key_id')
                .references('script_pub_key.id')
                .notNullable()
        }))

        promises.push(knex.schema.createTable('script_sig', table => {
            table.increments('id').primary()
            table.text('asm').notNullable()
            table.text('hex').notNullable()
        }))

        promises.push(knex.schema.createTable('script_pub_key', table => {
            table.increments('id').primary()
            table.text('asm').notNullable()
            table.text('hex').notNullable()
            table.string('address')
            table.string('type').notNullable()
        }))

        promises.push(knex.schema.createTable('witness_data', table => {
            table.increments('id').primary()
            table.integer('transaction_input_id')
                .unsigned()
                .references('transaction_input.id')
                .notNullable()
            table.text('hex').notNullable()
        }))
        
        return await Promise.all(promises)
    }
};

exports.down = async function(knex) {
    const promises = []

    promises.push(knex.schema.dropTableIfExists('witness_data'))
    promises.push(knex.schema.dropTableIfExists('transaction_input'))
    promises.push(knex.schema.dropTableIfExists('transaction_output'))
    promises.push(knex.schema.dropTableIfExists('transaction'))
    promises.push(knex.schema.dropTableIfExists('script_sig'))
    promises.push(knex.schema.dropTableIfExists('script_pub_key'))

    return await Promise.all(promises)
};
