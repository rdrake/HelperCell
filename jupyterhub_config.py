import os

c = get_config()

c.JupyterHub.db_url = 'sqlite:////srv/jupyterhub/data/jupyterhub.sqlite'
c.JupyterHub.cookie_secret_file = '/srv/jupyterhub/data/jupyterhub_cookie_secret'
c.JupyterHub.spawner_class = 'simple'
c.JupyterHub.authenticator_class = 'nativeauthenticator.NativeAuthenticator'
c.NativeAuthenticator.open_signup = True
c.Authenticator.admin_users = {'admin'}
c.Authenticator.allow_all = True
c.NativeAuthenticator.import_from_config = True
c.Spawner.args = ['--allow-root']
c.Spawner.notebook_dir = '/srv/notebooks/{username}'

def pre_spawn_hook(spawner):
    d = f'/srv/notebooks/{spawner.user.name}'
    os.makedirs(d, exist_ok=True)

c.Spawner.pre_spawn_hook = pre_spawn_hook
