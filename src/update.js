import express from 'express'
import serverless from 'serverless-http'
import bodyParser from 'body-parser'
import cors from 'cors'
import sjcl from '@tinyanvil/sjcl'

import Pool from './js/pg'
import { sendYnabFiles } from './js/ynab'

const app = express()

app.use(cors())
app.use(bodyParser.json())

app.post('/update', async (req, res) => {
  try {
    if (
      !req.body.id
      || !req.body.account_id
    ) throw 400

    const id = req.body.id
    const account_id = req.body.account_id
    const account = await Pool.query(`
      SELECT * FROM accounts
      WHERE id = '${id}'
    `).then(res => res.rows[0])

    const parsedCipher = JSON.parse(Buffer.from(account.cipher, 'base64').toString('utf8'))
    const email = parsedCipher.email

    if (parsedCipher.ct)
      throw 400

    parsedCipher.ynab_account_id = account_id

    if (parsedCipher.pending_files) {
      await sendYnabFiles(
        parsedCipher,
        parsedCipher.pending_files
      )
      delete parsedCipher.pending_files
      delete parsedCipher.email
    }

    const cipher = Buffer.from(sjcl.encrypt(
      email + id,
      JSON.stringify(parsedCipher)
    )).toString('base64')

    await Pool.query(`
      UPDATE accounts SET
        cipher='${cipher}'
      WHERE id='${id}'
    `)

    res.sendStatus(200)
  }

  catch (err) {
    console.error(err)
    res.sendStatus(400)
  }
})

export default serverless(app)