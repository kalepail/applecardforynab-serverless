import sgMail from '@sendgrid/mail'

sgMail.setApiKey(process.env.SENDGRID_API_KEY)
global.Promise = require('bluebird')

export default function(email, id) {
  const redirectUri = process.env.NODE_ENV === 'development' ? 'http://localhost:3333' : 'https://applecardforynab.com'

  return sgMail.send({
    to: email,
    from: 'noreply@applecardforynab.com',
    subject: 'Connect your YNAB account',
    html: `
      <h1>Welcome to Apple Card for YNAB!</h1>
      <p>In order to parse and deliver your Apple Card transactions to your YNAB account we'll need to connect to your YNAB account.</p>

      <strong>
      <a href="${redirectUri}?id=${id}">Connect your YNAB account</a>
      </strong>

      <br/>
      <br/>
      <aside>Need a little more info? Read our <a href="https://applecardforynab.com/assets/docs/privacy.md">privacy policy</a>.</aside>
    `,
  })
}