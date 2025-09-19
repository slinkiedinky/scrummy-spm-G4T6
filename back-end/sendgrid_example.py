import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

message = Mail(
    from_email='yongray.teo.2022@scis.smu.edu.sg',
    to_emails='teoyongray@hotmail.com',
    subject='Subject Sample',
    html_content='<strong>Hello There!</strong>')
try:
    sg = SendGridAPIClient(os.environ.get('SENDGRID_API_KEY'))
    response = sg.send(message)
    print(response.status_code)
    print(response.body)
    print(response.headers)
except Exception as e:
    print(e)