require 'sinatra'
require 'CSV'
require 'json'

before do
  if request.request_method == "POST"
    body_parameters = request.body.read
    params.merge!(JSON.parse(body_parameters))
  end
end

get '/' do
  @files = Dir.entries('public/uploads').keep_if { |f| f.length > 2 }
  @preprocessors = Dir.entries('public/configs').keep_if { |f| f.length > 2 && f != '.DS_Store'}
  @preprocessors.collect! { |f| f.gsub(".json",'') }
  erb :index
end

get '/file' do
  content_type :json
  csv = CSV.read('public/uploads/' + params[:filename], col_sep: '|' )
  {data: csv}.to_json
end

post '/upload' do
  File.open('public/uploads/' + params[:file][:filename], "w") do |f|
    f.write(params[:file][:tempfile].read)
  end
  redirect to('/')
end

post '/config' do
  File.open('public/configs/' + params[:filename] + '.json', "w") do |f|
    f.write(JSON.dump(params[:contents]))
  end
  return 'Hi'
end

get '/config' do
  content_type :json

  contents = ''
  File.open('public/configs/' + params[:filename] + '.json', "r") do |f|
    contents = f.read
  end
  return contents
end

post '/results' do
  colsep = '|'

  File.open('public/results/' + params[:filename] + '.csv', "w") do |f|
    params[:contents].each do |row|
      row.each do |c|
        if c.kind_of? String
          f.print c.strip
        else
          f.print c
        end
        f.print colsep
      end
      f.print("\n")
    end
  end
  return 'public/results/' + params[:filename] + '.csv'
end

get '/results/:filename' do
  contents = ''
  File.open('public/results/' + params[:filename], "r") do |f|
    contents = f.read
  end
  return contents
end
