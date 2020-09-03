import express from 'express'
import serverless from 'serverless-http'
import multer from 'multer'
import _ from 'lodash'
import shajs from 'sha.js'
import sjcl from '@tinyanvil/sjcl'

import Pool from './js/pg'
import { sendYnabFiles } from './js/ynab'
import sendGrid from './js/sendgrid'

// TODO:
// Ensure good error reporting
// Firewall endpoint
// Limit attachment filesize

const app = express()

const storage = multer.memoryStorage()
const upload = multer({storage})

app.post('/parse', upload.any(), async (req, res) => {
  try {
    if (!req.body.from)
      throw 400

    else {
      const email = req.body.from
      const id = shajs('sha256').update(email).digest('hex')
      const account = await Pool.query(`
        SELECT * FROM accounts
        WHERE id='${id}'
      `).then(res => res.rows[0])

      if (!account) {
        const pending_files = _.map(req.files, (file) => Buffer.from(file.buffer).toString('utf8'))
        const cipher = Buffer.from(JSON.stringify({
          email,
          pending_files
        })).toString('base64')

        await Pool.query(`
          INSERT INTO accounts (id, cipher)
          values ('${id}', '${cipher}')
        `)

        await sendGrid(email, id)
      }

      else {
        const parsedCipher = JSON.parse(
          sjcl.decrypt(
            email + id,
            Buffer.from(account.cipher, 'base64').toString('utf8')
          )
        )

        await sendYnabFiles(
          parsedCipher,
          _.map(req.files, (file) => Buffer.from(file.buffer).toString('utf8')),
          id,
          email
        )
      }

      res.sendStatus(200)
    }
  }

  catch (err) {
    console.error(err)
    res.sendStatus(400)
  }
})

export default serverless(app)