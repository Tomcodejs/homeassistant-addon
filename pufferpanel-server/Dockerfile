ARG BUILD_FROM
FROM pufferpanel/pufferpanel:latest

# Bashio est nécessaire pour utiliser les fonctions de logging Home Assistant
COPY run.sh /
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
