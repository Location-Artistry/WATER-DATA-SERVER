# WATER-DATA-SERVER
Service to pull data from USGS gaging stations in Michigan Watersheds and create API which provides JSON output.<br>
Project began in January 2020, updated in late May 2020.<br>
Pulls from two separate url endpoints, first gets curren flow and gage height, second pulls stats for todays date<br>
The two sources are then compared to generate the percentile and the curren status of the gage eg.<br>
"BELOW NORMAL," to "MUCH ABOVE NORMAL"
