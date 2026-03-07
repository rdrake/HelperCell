import os
c = get_config()  # Initialize configuration object

c.JupyterHub.authenticator_class = 'nativeauthenticator.NativeAuthenticator'
c.NativeAuthenticator.open_signup = True

user_file = './jupyterhub/users.txt'

allowed = {'admin'} 

if os.path.exists(user_file):
    with open(user_file, 'r') as f:
        # Read lines, strip whitespace, and ignore empty lines
        file_users = {line.strip() for line in f if line.strip()}
        allowed.update(file_users)

c.Authenticator.allowed_users = allowed
c.Authenticator.admin_users = {'admin'}
c.NativeAuthenticator.import_from_config = True 

